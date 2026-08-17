import { isExecutionUsageObservation } from './execution-usage.js';
export const WORKER_STATUSES = ['created', 'queued', 'starting', 'ready', 'busy', 'completed', 'failed', 'cancelled'];
const STATUS = new Set(WORKER_STATUSES);
const CATEGORIES = new Set(['quick', 'standard', 'deep', 'visual', 'critical']);
const WORKER_KEYS = new Set(['id', 'task_id', 'role', 'category', 'session_id', 'parent_session_id', 'parent_mission_id', 'forked_from_session_id', 'requested_model', 'requested_model_variant', 'model', 'model_variant', 'projected_model', 'projected_model_variant', 'fallbacks', 'selected_methodologies', 'loaded_methodologies', 'methodologies', 'fingerprint', 'status', 'attempt', 'generation_at_spawn', 'started_at', 'updated_at', 'completed_at', 'last_result_digest', 'last_result_at', 'write_set', 'native_state_hash', 'native_diff_baseline', 'native_diff_final', 'restart_reconcile_pending', 'runtime_recovery_pending', 'runtime_recovery_attempt', 'last_runtime_failure_kind', 'runtime_fallback_exhausted', 'model_selection_reason', 'fallback_history', 'effective_model', 'effective_model_variant', 'effective_model_verified', 'effective_model_variant_verified', 'effective_model_source', 'effective_model_observed_at', 'semantic_pause_revision', 'usage_observations']);
function record(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function strings(v) { return Array.isArray(v) && v.every(x => typeof x === 'string'); }
function finite(v) { return typeof v === 'number' && Number.isFinite(v); }
function stringRecord(v) { return record(v) && Object.values(v).every(x => typeof x === 'string'); }
function methodology(v) { return record(v) && typeof v.name === 'string' && /^hi-[a-z0-9-]+$/.test(v.name) && ['project', 'personal', 'hi'].includes(String(v.provider)) && typeof v.source_path === 'string' && (v.source_sha256 === undefined || typeof v.source_sha256 === 'string') && ['allow', 'ask', 'deny'].includes(String(v.permission)) && ['native-skill-tool', 'none'].includes(String(v.injection)) && finite(v.selected_at); }
function fallback(v) { return record(v) && (v.from === undefined || typeof v.from === 'string') && typeof v.to === 'string' && (v.variant === undefined || typeof v.variant === 'string') && typeof v.reason === 'string' && ['dispatch', 'runtime'].includes(String(v.phase)) && finite(v.at); }
export function isWorkerContract(v) {
    if (!record(v) || !Object.keys(v).every(k => WORKER_KEYS.has(k)) || typeof v.id !== 'string' || typeof v.task_id !== 'string' || typeof v.role !== 'string' || typeof v.category !== 'string' || !CATEGORIES.has(v.category) || typeof v.parent_session_id !== 'string' || typeof v.parent_mission_id !== 'string' || typeof v.fingerprint !== 'string' || typeof v.status !== 'string' || !STATUS.has(v.status))
        return false;
    if (!strings(v.fallbacks) || !strings(v.selected_methodologies) || !strings(v.loaded_methodologies) || !Array.isArray(v.methodologies) || !v.methodologies.every(methodology) || !Number.isInteger(v.attempt) || Number(v.attempt) < 0 || !Number.isInteger(v.generation_at_spawn) || Number(v.generation_at_spawn) < 1 || !finite(v.updated_at))
        return false;
    for (const k of ['session_id', 'forked_from_session_id', 'requested_model', 'requested_model_variant', 'model', 'model_variant', 'projected_model', 'projected_model_variant', 'last_result_digest', 'native_state_hash', 'last_runtime_failure_kind', 'effective_model', 'effective_model_variant', 'effective_model_source'])
        if (v[k] !== undefined && typeof v[k] !== 'string')
            return false;
    for (const k of ['started_at', 'completed_at', 'last_result_at', 'runtime_recovery_attempt', 'effective_model_observed_at', 'semantic_pause_revision'])
        if (v[k] !== undefined && !finite(v[k]))
            return false;
    for (const k of ['restart_reconcile_pending', 'runtime_recovery_pending', 'runtime_fallback_exhausted', 'effective_model_verified', 'effective_model_variant_verified'])
        if (v[k] !== undefined && typeof v[k] !== 'boolean')
            return false;
    if (v.write_set !== undefined && !strings(v.write_set))
        return false;
    if (v.model_selection_reason !== undefined && !strings(v.model_selection_reason))
        return false;
    if (v.native_diff_baseline !== undefined && !stringRecord(v.native_diff_baseline))
        return false;
    if (v.native_diff_final !== undefined && !stringRecord(v.native_diff_final))
        return false;
    if (v.fallback_history !== undefined && (!Array.isArray(v.fallback_history) || !v.fallback_history.every(fallback)))
        return false;
    if (v.usage_observations !== undefined && (!Array.isArray(v.usage_observations) || v.usage_observations.length > 32 || !v.usage_observations.every(isExecutionUsageObservation)))
        return false;
    if (v.projected_model_variant !== undefined && v.projected_model === undefined)
        return false;
    return true;
}
