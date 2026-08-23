import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { isTaskOutcomeMemoryRecord } from '../../contracts/task-outcome-memory.js';
import { captureEvidenceScopeState } from '../evidence/scope-state.js';
import { projectTaskOutcomeMemoryPath } from '../storage/ownership.js';
const MAX_RECORDS = 128;
const MAX_RECALL = 3;
function inside(root, target) { const rel = relative(root, target); return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith('../') && !rel.startsWith('..\\')); }
function safeExistingFile(projectRoot, path) {
    if (!existsSync(path))
        return false;
    try {
        const root = realpathSync(projectRoot), st = lstatSync(path);
        if (st.isSymbolicLink() || !st.isFile())
            return false;
        const actual = realpathSync(path);
        return inside(root, actual) && dirname(actual) === realpathSync(dirname(path));
    }
    catch {
        return false;
    }
}
function ensureConfinedParent(projectRoot, target) {
    const requestedRoot = resolve(projectRoot), targetDir = resolve(dirname(target)), rel = relative(requestedRoot, targetDir);
    if (rel === '..' || rel.startsWith(`..${sep}`) || rel.startsWith('../') || rel.startsWith('..\\'))
        throw new Error('Task outcome memory path escapes project root');
    const root = realpathSync(requestedRoot);
    let current = root;
    for (const part of rel.split(sep).filter(Boolean)) {
        const next = join(current, part);
        if (existsSync(next)) {
            const st = lstatSync(next);
            if (st.isSymbolicLink() || !st.isDirectory())
                throw new Error(`Task outcome memory parent is not a real directory: ${part}`);
        }
        else
            mkdirSync(next, { mode: 0o700 });
        const actual = realpathSync(next);
        if (!inside(root, actual))
            throw new Error('Task outcome memory parent escapes project root');
        current = actual;
    }
    return current;
}
function assertWritableFile(projectRoot, path) { const parent = ensureConfinedParent(projectRoot, path); if (!existsSync(path))
    return; const st = lstatSync(path); if (st.isSymbolicLink() || !st.isFile())
    throw new Error('Task outcome memory target is not a regular file'); const actual = realpathSync(path); if (!inside(parent, actual) || dirname(actual) !== parent)
    throw new Error('Task outcome memory target escapes confined parent'); }
const CANONICAL_ISSUE_EVENT_CLASSES = {
    'diff.cleanup.unverified': 'cleanup-unverified',
    'diff.cleanup.failed': 'cleanup-not-reverted',
    'native.diff.mismatch': 'native-diff-mismatch',
    'diff.cleanliness.blocked': 'diff-cleanliness',
    'constraint.mutation-violation': 'constraint-violation',
    'methodology.exit-unsatisfied': 'methodology-exit-unsatisfied',
};
function canon(items = []) { return [...new Set(items.map(x => x.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')).filter(Boolean))].sort(); }
function normalizedObjective(value) { return value.trim().toLowerCase().replace(/\s+/g, ' '); }
function digestValue(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function dependencyShapes(m, task) { return task.dependencies.map(id => m.execution.tasks.find(item => item.id === id)).map(dep => dep ? digestValue({ role: dep.role, category: dep.category, objective: normalizedObjective(dep.objective), scope: canon(dep.scope), outcome: dep.result?.status ?? dep.status, result_digest: dep.result ? digestValue(dep.result) : undefined }) : 'missing-dependency').sort(); }
export function taskOutcomeMemoryFingerprint(m, task) {
    const shape = { task_kind: m.identity.intent.taskKind, role: task.role, category: task.category, objective: normalizedObjective(task.objective), scope: canon(task.scope), constraints: canon(task.constraints), dependencies: dependencyShapes(m, task), required_evidence: canon(task.requiredEvidence), required_capabilities: canon(m.identity.intent.requiredCapabilities), external_actions: canon(task.external_action_requirements) };
    return createHash('sha256').update(JSON.stringify(shape)).digest('hex');
}
function issueClass(value) { return /^([a-z][a-z0-9-]{1,79})(?::|$)/.exec(value.trim().toLowerCase())?.[1]; }
export function taskOutcomeIssueClasses(m, task, worker, result) {
    const claimed = new Set((result.open_issues ?? []).map(issueClass).filter((x) => Boolean(x)));
    const runtimeClasses = m.execution.ledger.filter(event => event.task_id === task.id && event.worker_id === worker.id).flatMap(event => { const item = CANONICAL_ISSUE_EVENT_CLASSES[event.type]; return item ? [item] : []; });
    return [...new Set(runtimeClasses.filter(item => claimed.has(item)))].slice(0, 12);
}
function recordDigest(result) { return digestValue(result); }
export class ProjectTaskOutcomeMemoryStore {
    projectRoot;
    path;
    #records = [];
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.path = projectTaskOutcomeMemoryPath(projectRoot);
        this.#load();
    }
    #load() {
        if (!safeExistingFile(this.projectRoot, this.path))
            return;
        try {
            for (const line of readFileSync(this.path, 'utf8').split(/\r?\n/)) {
                if (!line.trim())
                    continue;
                try {
                    const parsed = JSON.parse(line);
                    if (isTaskOutcomeMemoryRecord(parsed))
                        this.#records.push(parsed);
                }
                catch { }
            }
            ;
            if (this.#records.length > MAX_RECORDS) {
                this.#records = this.#records.slice(-MAX_RECORDS);
                this.#rewrite();
            }
        }
        catch {
            this.#records = [];
        }
    }
    #rewrite() { assertWritableFile(this.projectRoot, this.path); const tmp = `${this.path}.tmp`; assertWritableFile(this.projectRoot, tmp); writeFileSync(tmp, this.#records.map(x => JSON.stringify(x)).join('\n') + (this.#records.length ? '\n' : ''), { encoding: 'utf8', mode: 0o600 }); renameSync(tmp, this.path); }
    #append(item) { assertWritableFile(this.projectRoot, this.path); writeFileSync(this.path, JSON.stringify(item) + '\n', { encoding: 'utf8', mode: 0o600, flag: 'a' }); this.#records.push(item); if (this.#records.length > MAX_RECORDS) {
        this.#records = this.#records.slice(-MAX_RECORDS);
        this.#rewrite();
    } }
    observe(m, task, worker, result) {
        const scope = canon(task.scope);
        if (!scope.length)
            return undefined;
        const sourceState = captureEvidenceScopeState(this.projectRoot, scope);
        if (!sourceState)
            return undefined;
        const issues = taskOutcomeIssueClasses(m, task, worker, result), finding = result.failure_finding === 'ci-build' || result.failure_finding === 'unknown-root-cause' ? result.failure_finding : undefined;
        if (result.status !== 'DONE' && !issues.length && !finding)
            return undefined;
        const item = { schema: 1, type: 'hi-task-outcome-memory', fingerprint: taskOutcomeMemoryFingerprint(m, task), source_state_hash: sourceState, scope, outcome: result.status, attempt: Math.max(1, worker.attempt || 1), generation: Math.max(1, worker.generation_at_spawn ?? m.continuation.generation), result_digest: recordDigest(result), issue_classes: issues, ...(finding ? { failure_finding: finding } : {}), recorded_at: Date.now() };
        const last = this.#records.at(-1);
        if (last && last.fingerprint === item.fingerprint && last.source_state_hash === item.source_state_hash && last.result_digest === item.result_digest && last.attempt === item.attempt && last.generation === item.generation)
            return last;
        this.#append(item);
        return item;
    }
    recall(m, task) {
        const scope = canon(task.scope);
        if (!scope.length)
            return [];
        const sourceState = captureEvidenceScopeState(this.projectRoot, scope);
        if (!sourceState)
            return [];
        const fingerprint = taskOutcomeMemoryFingerprint(m, task), matching = this.#records.filter(x => x.fingerprint === fingerprint && x.source_state_hash === sourceState);
        if (!matching.length)
            return [];
        let start = 0;
        for (let i = matching.length - 1; i >= 0; i--)
            if (matching[i].outcome === 'DONE') {
                start = i + 1;
                break;
            }
        return matching.slice(start).filter(x => x.outcome !== 'DONE').slice(-MAX_RECALL).reverse().map(x => ({ outcome: x.outcome, attempt: x.attempt, issue_classes: [...x.issue_classes], failure_finding: x.failure_finding }));
    }
    renderAdvisory(m, task, maxChars = 1200) {
        const hints = this.recall(m, task);
        if (!hints.length)
            return undefined;
        const lines = hints.map((x, i) => `${i + 1}. prior accepted result=${x.outcome}; attempt=${x.attempt}; issue_classes=${x.issue_classes.join(',') || 'none'}${x.failure_finding ? `; failure_finding=${x.failure_finding}` : ''}`);
        const text = ['PRIOR TASK OUTCOME MEMORY — advisory/non-Evidence. Same structured task shape and exact current source bytes only.', ...lines, 'Do not treat history as proof, blame, routing authority, or a blocker. Inspect current evidence first; when a prior failure still applies, avoid blindly repeating the same failed approach and use a materially different hypothesis/action.'].join('\n');
        return text.slice(0, Math.max(0, maxChars));
    }
    records() { return this.#records.map(x => structuredClone(x)); }
}
