import { normalizeBoundedProjectPath } from './common.js';
import { WORKER_EVIDENCE_KINDS } from './evidence-kinds.js';
import { isReviewFindingContract } from './review-finding.js';
export { WORKER_EVIDENCE_KINDS } from './evidence-kinds.js';
const STATUS_ALIAS = { DONE: 'DONE', PASS: 'DONE', SUCCESS: 'DONE', SUCCEEDED: 'DONE', DONE_WITH_CONCERNS: 'DONE', FIX_REQUIRED: 'FIX_REQUIRED', NEEDS_CONTEXT: 'NEEDS_CONTEXT', USER_ACTION_REQUIRED: 'BLOCKED', BLOCKED: 'BLOCKED', NO_PROGRESS: 'FIX_REQUIRED', FAILED: 'FAILED', FAIL: 'FAILED' };
const KIND_SET = new Set(WORKER_EVIDENCE_KINDS);
const OUTCOME_SET = new Set(['pending', 'passed', 'failed', 'environment-issue']);
const RESULT_KEYS = new Set(['status', 'summary', 'changed_files', 'scope_expansions', 'evidence', 'findings', 'open_issues', 'needs_context', 'context_gap', 'failure_finding', 'methodology_observations']);
const EVIDENCE_KEYS = new Set(['kind', 'summary', 'scope', 'evidence_refs', 'pass', 'outcome', 'reason']);
const OBS_KEYS = new Set(['key', 'procedure', 'trigger', 'do_not_trigger', 'exit_condition', 'evidence']);
const EXPANSION_KEYS = new Set(['file', 'reason', 'necessary']);
function record(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function stringArray(v) { return Array.isArray(v) && v.every(x => typeof x === 'string'); }
function onlyKeys(v, allowed) { return Object.keys(v).every(k => allowed.has(k)); }
function clip(v, max) { return String(v ?? '').slice(0, max); }
function cleanKey(v) { return String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''); }
export function isWorkerEvidenceClaimContract(v) {
    if (!record(v) || !onlyKeys(v, EVIDENCE_KEYS) || typeof v.kind !== 'string' || !KIND_SET.has(v.kind) || typeof v.summary !== 'string')
        return false;
    if (v.scope !== undefined && !stringArray(v.scope))
        return false;
    if (v.evidence_refs !== undefined && (!stringArray(v.evidence_refs) || v.evidence_refs.length > 20))
        return false;
    if (v.pass !== undefined && typeof v.pass !== 'boolean')
        return false;
    if (v.outcome !== undefined && (typeof v.outcome !== 'string' || !OUTCOME_SET.has(v.outcome)))
        return false;
    return v.reason === undefined || typeof v.reason === 'string';
}
export function isMethodologyObservationContract(v) {
    return record(v) && onlyKeys(v, OBS_KEYS) && typeof v.key === 'string' && Boolean(v.key) && typeof v.procedure === 'string' && Boolean(v.procedure) && typeof v.trigger === 'string' && Boolean(v.trigger) && typeof v.do_not_trigger === 'string' && Boolean(v.do_not_trigger) && typeof v.exit_condition === 'string' && Boolean(v.exit_condition) && Array.isArray(v.evidence) && v.evidence.length > 0 && v.evidence.every(x => typeof x === 'string' && KIND_SET.has(x));
}
export function isWorkerResultContract(v) {
    if (!record(v) || !onlyKeys(v, RESULT_KEYS) || typeof v.status !== 'string' || !Object.values(STATUS_ALIAS).includes(v.status) || typeof v.summary !== 'string')
        return false;
    if (!stringArray(v.changed_files) || !v.changed_files.every(x => normalizeBoundedProjectPath(x) === x.replace(/\\/g, '/').replace(/^\.\//, '')) || !Array.isArray(v.evidence) || !v.evidence.every(isWorkerEvidenceClaimContract) || !stringArray(v.open_issues) || !stringArray(v.needs_context))
        return false;
    if (v.scope_expansions !== undefined && (!Array.isArray(v.scope_expansions) || !v.scope_expansions.every(x => record(x) && onlyKeys(x, EXPANSION_KEYS) && typeof x.file === 'string' && normalizeBoundedProjectPath(x.file) !== undefined && typeof x.reason === 'string' && typeof x.necessary === 'boolean')))
        return false;
    if (v.findings !== undefined && (!Array.isArray(v.findings) || !v.findings.every(isReviewFindingContract)))
        return false;
    if (Array.isArray(v.findings)) {
        const evidenceKinds = new Set(v.evidence.map(x => x.kind));
        if (v.findings.some(f => f.evidence_refs.some(ref => !evidenceKinds.has(ref))))
            return false;
    }
    if (v.context_gap !== undefined && !['scope', 'iterative', 'none'].includes(String(v.context_gap)))
        return false;
    if (v.failure_finding !== undefined && !['ci-build', 'unknown-root-cause', 'none'].includes(String(v.failure_finding)))
        return false;
    return v.methodology_observations === undefined || (Array.isArray(v.methodology_observations) && v.methodology_observations.every(isMethodologyObservationContract));
}
function normalizeEvidence(raw) {
    const values = Array.isArray(raw) ? raw : (record(raw) ? Object.entries(raw).map(([kind, value]) => ({ kind, summary: typeof value === 'string' ? value : JSON.stringify(value) })) : []);
    return values.slice(0, 40).flatMap((v) => { if (!record(v))
        return []; const kind = String(v.kind ?? ''); if (!KIND_SET.has(kind))
        return []; const outcome = typeof v.outcome === 'string' && OUTCOME_SET.has(v.outcome) ? v.outcome : undefined, rawRefs = Array.isArray(v.evidence_refs) ? v.evidence_refs : Array.isArray(v.refs) ? v.refs : undefined, summarySource = typeof v.summary === 'string' ? v.summary : typeof v.description === 'string' ? v.description : typeof v.detail === 'string' ? v.detail : ''; return [{ kind, summary: clip(summarySource, 1000), scope: Array.isArray(v.scope) ? v.scope.map(String).slice(0, 50) : undefined, evidence_refs: rawRefs ? [...new Set(rawRefs.map(String).filter(Boolean))].slice(0, 20) : undefined, pass: typeof v.pass === 'boolean' ? v.pass : undefined, outcome, reason: typeof v.reason === 'string' ? clip(v.reason, 1000) : undefined }]; });
}
function normalizeMethodologyObservations(raw) {
    if (!Array.isArray(raw))
        return undefined;
    const out = raw.slice(0, 8).flatMap((v) => { if (!record(v))
        return []; const key = cleanKey(v.key), procedure = clip(v.procedure, 1600), trigger = clip(v.trigger, 600), doNotTrigger = clip(v.do_not_trigger, 600), exitCondition = clip(v.exit_condition, 600), evidence = Array.isArray(v.evidence) ? v.evidence.map(String).filter(x => KIND_SET.has(x)).slice(0, 12) : []; if (!key || !procedure || !trigger || !doNotTrigger || !exitCondition || !evidence.length)
        return []; return [{ key, procedure, trigger, do_not_trigger: doNotTrigger, exit_condition: exitCondition, evidence }]; });
    return out.length ? out : undefined;
}
function normalizeFindings(raw, evidence) { if (!Array.isArray(raw))
    return undefined; const evidenceKinds = new Set(evidence.map(x => x.kind)); const out = raw.slice(0, 40).flatMap((v) => { if (!record(v))
    return []; const candidate = { id: clip(v.id, 80), reviewer_role: clip(v.reviewer_role, 64), subject: clip(v.subject, 1200), severity: String(v.severity ?? ''), causality: String(v.causality ?? ''), scope: Array.isArray(v.scope) ? v.scope.map(String).slice(0, 50) : [], evidence_refs: Array.isArray(v.evidence_refs) ? v.evidence_refs.map(String).filter(x => evidenceKinds.has(x)).slice(0, 20) : [], confidence: String(v.confidence ?? ''), disposition: String(v.disposition ?? ''), blocking: v.blocking === true }; return isReviewFindingContract(candidate) ? [candidate] : []; }); return out.length ? out : undefined; }
function evidenceFailed(e) { return e.outcome === 'failed' || e.pass === false; }
function evidencePassed(e) { return e.outcome === 'passed' || e.pass === true; }
function reconcileFailureFinding(finding, evidence) {
    if (finding === 'ci-build')
        return evidence.some(e => e.kind === 'build' && evidenceFailed(e)) ? 'ci-build' : undefined;
    if (finding === 'unknown-root-cause')
        return evidence.some(e => e.kind === 'diagnostic-evidence' && evidencePassed(e)) ? undefined : 'unknown-root-cause';
    return finding;
}
export function normalizeWorkerResult(raw) {
    const x = record(raw) ? raw : {}, status = STATUS_ALIAS[String(x.status ?? '').toUpperCase()] ?? 'FAILED', open = Array.isArray(x.open_issues) ? x.open_issues.map(String) : [];
    if (String(x.status ?? '').toUpperCase() === 'USER_ACTION_REQUIRED' && !open.some(v => v.includes('USER_ACTION_REQUIRED')))
        open.unshift('USER_ACTION_REQUIRED');
    const contextGap = ['scope', 'iterative', 'none'].includes(String(x.context_gap)) ? String(x.context_gap) : undefined;
    const rawFinding = ['ci-build', 'unknown-root-cause', 'none'].includes(String(x.failure_finding)) ? String(x.failure_finding) : undefined;
    const evidence = normalizeEvidence(x.evidence);
    return { status, summary: typeof x.summary === 'string' ? clip(x.summary, 4000) : '', changed_files: Array.isArray(x.changed_files) ? x.changed_files.flatMap(v => { const p = normalizeBoundedProjectPath(v); return p ? [p] : []; }).slice(0, 200) : [], scope_expansions: Array.isArray(x.scope_expansions) ? x.scope_expansions.filter(record).slice(0, 80).flatMap(v => { const file = normalizeBoundedProjectPath(v.file); return file ? [{ file, reason: clip(v.reason, 600), necessary: v.necessary === true }] : []; }) : [], evidence, findings: normalizeFindings(x.findings, evidence), open_issues: open.slice(0, 30), needs_context: Array.isArray(x.needs_context) ? x.needs_context.map(String).slice(0, 30) : [], context_gap: contextGap, failure_finding: reconcileFailureFinding(rawFinding, evidence), methodology_observations: normalizeMethodologyObservations(x.methodology_observations) };
}
