import { createHash } from 'node:crypto';
import { relative, resolve, sep } from 'node:path';
import { appendLedger } from '../ledger/ledger.js';
import { normalizeBoundedProjectPath } from '../../contracts/common.js';
import { verificationSatisfied } from '../verification/policy.js';
function id() { return `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }
const WRITE_TOOLS = new Set(['write', 'edit', 'patch', 'apply_patch', 'multiedit']);
const SHELL_MUTATION_COMMAND = /(?:^|[;&|]\s*)(?:rm|mv|cp|touch|mkdir|rmdir|chmod|chown|chgrp|ln|truncate|dd|install|patch|rsync|tee|sed\s+-i|perl\s+-pi|python[^\n]*(?:\bwrite\b|\bopen\s*\([^)]*,\s*['"]?[wa+])|node[^\n]*(?:writeFileSync|writeFile|appendFileSync|appendFile|renameSync|rename|unlinkSync|unlink|mkdirSync|mkdir|rmSync|chmodSync|chmod)|git\s+(?:apply|am|checkout|switch|merge|rebase|cherry-pick|restore|reset|clean|stash)|npm\s+(?:install|uninstall|update|run\s+build)|pnpm\s+(?:add|remove|install|update|build)|yarn\s+(?:add|remove|install|build)|bun\s+(?:add|remove|install|build)|make(?:\s|$)|cmake\s+--build)\b/i;
const SHELL_REDIRECTION = /(?:^|[^<>])(?:>>?|2>>?|1>>?)\s*[^&|]/;
export function shellMayMutate(command) { return SHELL_MUTATION_COMMAND.test(command) || SHELL_REDIRECTION.test(command); }
const SHELL_BOUNDARY = '(?:^|[;&|]\\s*)';
const PREFIX = '(?:(?:sudo|env(?:\\s+[A-Za-z_][A-Za-z0-9_]*=[^\\s]+)*)\\s+)?';
const PACKAGE = '(?:npm|pnpm|yarn|bun)';
const TEST_INVOCATION = new RegExp(`${SHELL_BOUNDARY}${PREFIX}(?:${PACKAGE}\\s+(?:(?:run\\s+)?test(?:\\b|:))|node\\s+--test\\b|(?:python(?:3)?\\s+-m\\s+)?pytest\\b|vitest\\b|jest\\b|go\\s+test\\b|cargo\\s+test\\b|dotnet\\s+test\\b|mvn(?:w)?\\s+(?:[^;&|]*\\s)?test\\b|(?:gradle|\\.\/gradlew)\\s+(?:[^;&|]*\\s)?test\\b)`, 'i');
const TYPECHECK_INVOCATION = new RegExp(`${SHELL_BOUNDARY}${PREFIX}(?:${PACKAGE}\\s+(?:(?:run\\s+)?(?:typecheck|type-check|check:types?)(?:\\b|:))|(?:npx\\s+)?tsc\\b|(?:python(?:3)?\\s+-m\\s+)?(?:mypy|pyright)\\b)`, 'i');
const LINT_INVOCATION = new RegExp(`${SHELL_BOUNDARY}${PREFIX}(?:${PACKAGE}\\s+(?:(?:run\\s+)?lint(?:\\b|:))|(?:npx\\s+)?eslint\\b|(?:python(?:3)?\\s+-m\\s+)?ruff(?:\\s+check)?\\b)`, 'i');
const BUILD_INVOCATION = new RegExp(`${SHELL_BOUNDARY}${PREFIX}(?:${PACKAGE}\\s+(?:(?:run\\s+)?build(?:\\b|:))|cargo\\s+check\\b|go\\s+build\\b|dotnet\\s+build\\b|mvn(?:w)?\\s+(?:[^;&|]*\\s)?(?:package|verify)\\b|(?:gradle|\\.\/gradlew)\\s+(?:[^;&|]*\\s)?build\\b)`, 'i');
const CHECK_INVOCATION = new RegExp(`${SHELL_BOUNDARY}${PREFIX}${PACKAGE}\\s+(?:(?:run\\s+)?check(?:\\b|:))`, 'i');
export function verificationCommandKind(command) { if (TEST_INVOCATION.test(command))
    return 'targeted-tests'; if (TYPECHECK_INVOCATION.test(command))
    return 'typecheck'; if (LINT_INVOCATION.test(command))
    return 'lint'; if (BUILD_INVOCATION.test(command))
    return 'build'; if (CHECK_INVOCATION.test(command))
    return 'changed-surface-sanity'; return undefined; }
export function isVerificationCommand(command) { return verificationCommandKind(command) !== undefined; }
export function toolMayMutate(tool, args) { return WRITE_TOOLS.has(tool) || (tool === 'bash' && shellMayMutate(typeof args?.command === 'string' ? args.command : '')); }
function numericExit(output) { for (const v of [output?.metadata?.exit, output?.metadata?.exitCode, output?.metadata?.exit_code, output?.exit, output?.exitCode, output?.exit_code]) {
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    if (typeof v === 'string' && /^-?\d+$/.test(v.trim()))
        return Number(v);
} return undefined; }
const ENVIRONMENT_FAILURE = /(command not found|not recognized as an internal|no module named|cannot find module|module not found|missing dependency|enoent|spawn .* (?:not found|failed)|executable .* not found|permission denied|eacces|network.*unreachable|temporary failure in name resolution|connection refused|connection reset|socket hang|timed?\s*out|timeout|unable to resolve host|could not resolve host|certificate (?:verify|verification)|tls handshake)/i;
function outcomeOf(output, text) { const exit = numericExit(output); if (ENVIRONMENT_FAILURE.test(text))
    return { outcome: 'environment-issue', reason: 'verification-environment-unavailable' }; if (exit !== undefined)
    return { outcome: exit === 0 ? 'passed' : 'failed', reason: exit === 0 ? undefined : `verification-exit-${exit}` }; if (/(^|\n)\s*(fail|failed|error)|exit\s*code\s*[1-9]/i.test(text))
    return { outcome: 'failed', reason: 'verification-reported-failure' }; return { outcome: 'pending', reason: 'verification-exit-unknown' }; }
function absolutePath(value) { return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value); }
function evidencePath(value) { return value.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, ''); }
function sameEvidenceSurface(a, b) { const x = evidencePath(a), y = evidencePath(b); return Boolean(x && y && (x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`))); }
function mutationAffectsEvidence(scope, files) { if (!files.length || !scope.length)
    return true; return scope.some(s => files.some(f => sameEvidenceSurface(s, f))); }
function refreshCompatibilityFreshness(mission) { mission.execution.evidence.fresh = mission.execution.evidence.items.some(e => (e.outcome === 'passed' || e.pass === true) && !e.invalidated_at); }
export function normalizeProjectPath(value, projectRoot) { const raw = value.trim(); if (!raw)
    return ''; if (!absolutePath(raw))
    return normalizeBoundedProjectPath(raw) ?? ''; if (!projectRoot)
    return ''; const root = resolve(projectRoot), abs = resolve(raw), rel = relative(root, abs); if (!rel)
    return ''; if (rel === '..' || rel.startsWith(`..${sep}`) || absolutePath(rel))
    return ''; return normalizeBoundedProjectPath(rel.replace(/\\/g, '/')) ?? ''; }
export function markMutation(mission, files = [], source = 'tool') {
    const now = Date.now(), changed = [...new Set(files.map(evidencePath).filter(Boolean))];
    mission.execution.evidence.last_mutation_at = now;
    const invalidated = [], claimIDs = new Set();
    for (const item of mission.execution.evidence.items)
        if (!item.invalidated_at && mutationAffectsEvidence(item.scope ?? [], changed)) {
            item.invalidated_at = now;
            invalidated.push(item.id);
            for (const id of item.obligation_ids ?? [])
                claimIDs.add(id);
        }
    const reopened = [];
    for (const obligation of mission.execution.obligations)
        if (obligation.kind === 'verification' && obligation.status === 'closed' && claimIDs.has(obligation.id)) {
            obligation.status = 'open';
            obligation.closedAt = undefined;
            reopened.push(obligation.id);
            appendLedger(mission, 'obligation.reopened', { payload: { obligation: obligation.id, owner: 'evidence-freshness', reason: 'claim-linked-evidence-invalidated', evidence_invalidated: invalidated.slice(0, 100) } });
        }
    refreshCompatibilityFreshness(mission);
    mission.vcs.changed_files = [...new Set([...mission.vcs.changed_files, ...changed])];
    appendLedger(mission, 'file.changed', { payload: { source, files: changed, evidence_invalidated: invalidated.slice(0, 100), verification_obligations_reopened: reopened, invalidation_mode: changed.length ? 'scope-overlap' : 'unknown-surface-fail-closed' } });
}
export function addEvidence(mission, input) { const item = { id: id(), observed_at: input.observed_at ?? Date.now(), kind: input.kind, summary: input.summary, scope: input.scope, source: input.source, trusted_source_class: input.trusted_source_class, source_session_id: input.source_session_id, source_state_hash: input.source_state_hash, scope_state_hash: input.scope_state_hash, task_id: input.task_id, obligation_ids: input.obligation_ids, evidence_refs: input.evidence_refs, producer_attempt: input.producer_attempt, pass: input.pass, outcome: input.outcome ?? (input.pass === true ? 'passed' : input.pass === false ? 'failed' : undefined), reason: input.reason, invalidated_at: input.invalidated_at }; mission.execution.evidence.items.push(item); if (mission.execution.evidence.items.length > 100)
    mission.execution.evidence.items.splice(0, mission.execution.evidence.items.length - 100); refreshCompatibilityFreshness(mission); appendLedger(mission, item.outcome === 'failed' ? 'verification.fail' : item.outcome === 'environment-issue' ? 'verification.environment-issue' : 'verification.pass', { payload: { kind: item.kind, summary: item.summary, reason: item.reason, trusted_source_class: item.trusted_source_class, source_session_id: item.source_session_id, source_state_hash: item.source_state_hash, task_id: item.task_id, obligation_ids: item.obligation_ids, evidence_refs: item.evidence_refs } }); return item; }
export function observeToolBefore(mission, tool, args, projectRoot) { if (WRITE_TOOLS.has(tool)) {
    const files = [args?.filePath, args?.path, args?.file].filter((x) => typeof x === 'string').map(x => normalizeProjectPath(x, projectRoot)).filter(Boolean);
    markMutation(mission, files, tool);
    return;
} const command = typeof args?.command === 'string' ? args.command : ''; if (tool === 'bash' && shellMayMutate(command))
    markMutation(mission, [], 'bash-mutation'); }
export function observeToolAfter(mission, tool, args, output, projectRoot, owner) {
    if (WRITE_TOOLS.has(tool))
        return;
    const command = typeof args?.command === 'string' ? args.command : '';
    if (tool === 'read' && mission.identity.intent.taskKind === 'review') {
        const rawPath = typeof args?.filePath === 'string' ? args.filePath : typeof args?.path === 'string' ? args.path : undefined, path = rawPath ? normalizeProjectPath(rawPath, projectRoot) : undefined;
        const text = typeof output === 'string' ? output : JSON.stringify(output ?? '');
        if (text.trim() && !/(error|failed)/i.test(text))
            addEvidence(mission, { kind: 'review-input', summary: path ? ('Read ' + path) : 'Read-only review input', scope: path ? [path] : [], source: 'read', trusted_source_class: 'runtime-observation', pass: true, outcome: 'passed' });
    }
    if (tool === 'skill' && mission.identity.intent.taskKind === 'review') {
        const text = typeof output === 'string' ? output : JSON.stringify(output ?? '');
        if (text.trim() && !/(error|failed)/i.test(text))
            addEvidence(mission, { kind: 'review-input', summary: 'Native skill content loaded', scope: [], source: 'skill', trusted_source_class: 'runtime-observation', pass: true, outcome: 'passed' });
    }
    if (tool === 'bash' && mission.identity.intent.taskKind === 'review' && !shellMayMutate(command)) {
        const text = typeof output === 'string' ? output : JSON.stringify(output ?? ''), exit = numericExit(output);
        if (text.trim() && (exit === undefined || exit === 0) && !/(error|failed)/i.test(text))
            addEvidence(mission, { kind: 'review-input', summary: 'Read-only command: ' + command.slice(0, 180), scope: [], source: 'bash', trusted_source_class: 'host-tool-observation', pass: true, outcome: 'passed' });
    }
    if (tool === 'bash') {
        const kind = verificationCommandKind(command);
        if (kind) {
            const text = typeof output === 'string' ? output : JSON.stringify(output ?? ''), out = outcomeOf(output, text), obligation_ids = owner?.obligation_ids ?? mission.execution.obligations.filter(o => o.kind === 'verification' && o.status === 'open').map(o => o.id);
            const stateHash = createHash('sha256').update(JSON.stringify({ command, exit: numericExit(output), output: text })).digest('hex');
            addEvidence(mission, { kind, summary: command.slice(0, 180), scope: owner?.scope ?? mission.vcs.changed_files, source: owner?.source ?? 'bash', trusted_source_class: owner?.trusted_source_class ?? 'host-tool-observation', source_session_id: owner?.source_session_id, source_state_hash: stateHash, task_id: owner?.task_id, obligation_ids, producer_attempt: owner?.producer_attempt, pass: out.outcome === 'passed' ? true : out.outcome === 'failed' ? false : undefined, outcome: out.outcome, reason: out.reason });
            for (const obligation of mission.execution.obligations.filter(o => o.kind === 'verification' && o.status === 'open'))
                if (verificationSatisfied(mission, obligation.id, projectRoot).ok) {
                    obligation.status = 'closed';
                    obligation.closedAt = Date.now();
                    appendLedger(mission, 'obligation.closed', { payload: { obligation: obligation.id, owner: 'verification-evidence' } });
                }
        }
    }
}
