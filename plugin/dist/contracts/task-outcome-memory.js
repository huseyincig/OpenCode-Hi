import { normalizeBoundedProjectPath } from './common.js';
export const TASK_OUTCOME_MEMORY_STATUS = ['DONE', 'FIX_REQUIRED', 'NEEDS_CONTEXT', 'BLOCKED', 'FAILED'];
export const TASK_OUTCOME_MEMORY_FAILURE_FINDINGS = ['ci-build', 'unknown-root-cause'];
const KEYS = new Set(['schema', 'type', 'fingerprint', 'source_state_hash', 'scope', 'outcome', 'attempt', 'generation', 'result_digest', 'issue_classes', 'failure_finding', 'recorded_at']);
const STATUS = new Set(TASK_OUTCOME_MEMORY_STATUS), FINDINGS = new Set(TASK_OUTCOME_MEMORY_FAILURE_FINDINGS);
function record(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function sha(v) { return typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v); }
function strings(v) { return Array.isArray(v) && v.every(x => typeof x === 'string'); }
export function isTaskOutcomeMemoryRecord(v) {
    if (!record(v) || !Object.keys(v).every(k => KEYS.has(k)) || v.schema !== 1 || v.type !== 'hi-task-outcome-memory' || !sha(v.fingerprint) || !sha(v.source_state_hash) || !sha(v.result_digest))
        return false;
    if (!strings(v.scope) || !v.scope.length || v.scope.length > 100 || !v.scope.every(x => normalizeBoundedProjectPath(x) === x))
        return false;
    if (typeof v.outcome !== 'string' || !STATUS.has(v.outcome) || !Number.isInteger(v.attempt) || Number(v.attempt) < 1 || !Number.isInteger(v.generation) || Number(v.generation) < 1)
        return false;
    if (!strings(v.issue_classes) || v.issue_classes.length > 12 || !v.issue_classes.every(x => /^[a-z][a-z0-9-]{1,79}$/.test(x)))
        return false;
    if (v.failure_finding !== undefined && (typeof v.failure_finding !== 'string' || !FINDINGS.has(v.failure_finding)))
        return false;
    return typeof v.recorded_at === 'number' && Number.isFinite(v.recorded_at) && v.recorded_at > 0;
}
