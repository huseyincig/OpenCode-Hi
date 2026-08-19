import { WORKER_EVIDENCE_KINDS } from './evidence-kinds.js';
export const MISSION_EVIDENCE_KINDS = [...WORKER_EVIDENCE_KINDS, 'review-input', 'lsp-diagnostics'];
const KIND_SET = new Set(MISSION_EVIDENCE_KINDS);
const OUTCOME_SET = new Set(['pending', 'passed', 'failed', 'environment-issue']);
const KEYS = new Set(['id', 'kind', 'summary', 'scope', 'source', 'source_session_id', 'source_state_hash', 'task_id', 'obligation_ids', 'evidence_refs', 'producer_attempt', 'observed_at', 'invalidated_at', 'pass', 'outcome', 'reason']);
function record(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function strings(v) { return Array.isArray(v) && v.every(x => typeof x === 'string'); }
export function isEvidenceItemContract(v) {
    if (!record(v) || !Object.keys(v).every(k => KEYS.has(k)) || typeof v.id !== 'string' || !v.id || typeof v.kind !== 'string' || !KIND_SET.has(v.kind) || typeof v.summary !== 'string' || !strings(v.scope) || typeof v.observed_at !== 'number' || !Number.isFinite(v.observed_at))
        return false;
    for (const key of ['source', 'source_session_id', 'source_state_hash', 'task_id', 'reason'])
        if (v[key] !== undefined && typeof v[key] !== 'string')
            return false;
    if (v.obligation_ids !== undefined && !strings(v.obligation_ids))
        return false;
    if (v.evidence_refs !== undefined && (!strings(v.evidence_refs) || v.evidence_refs.length > 20))
        return false;
    if (v.producer_attempt !== undefined) {
        const p = v.producer_attempt;
        if (!record(p) || !Object.keys(p).every(k => ['worker_id', 'execution_unit_id', 'attempt_id', 'run_id', 'ordinal', 'generation'].includes(k)) || Object.keys(p).length !== 6 || typeof p.worker_id !== 'string' || !p.worker_id || typeof p.execution_unit_id !== 'string' || !p.execution_unit_id || typeof p.attempt_id !== 'string' || !p.attempt_id || typeof p.run_id !== 'string' || !p.run_id || !Number.isInteger(p.ordinal) || Number(p.ordinal) < 0 || !Number.isInteger(p.generation) || Number(p.generation) < 1)
            return false;
    }
    if (v.invalidated_at !== undefined && (typeof v.invalidated_at !== 'number' || !Number.isFinite(v.invalidated_at)))
        return false;
    if (v.pass !== undefined && typeof v.pass !== 'boolean')
        return false;
    return v.outcome === undefined || (typeof v.outcome === 'string' && OUTCOME_SET.has(v.outcome));
}
