import { normalizeBoundedProjectPath } from './common.js';
import { isWorkerResultContract } from './worker-result.js';
import { isContextReferenceContract } from './context-reference.js';
import { EXTERNAL_ACTION_TYPES } from './external-action.js';
export const TASK_STATUSES = ['created', 'queued', 'running', 'waiting', 'completed', 'failed', 'cancelled', 'blocked'];
export const TASK_EXTERNAL_ACTIONS = EXTERNAL_ACTION_TYPES;
const STATUS = new Set(TASK_STATUSES);
const EXTERNAL = new Set(TASK_EXTERNAL_ACTIONS);
const CATEGORIES = new Set(['quick', 'standard', 'deep', 'visual', 'critical']);
const TASK_KEYS = new Set(['id', 'mission_id', 'objective', 'status', 'role', 'category', 'scope', 'constraints', 'dependencies', 'requiredEvidence', 'obligation_ids', 'context_artifacts', 'execution_profile', 'gate_ids', 'worker_id', 'result', 'diff_cleanliness', 'external_action_requirements', 'created_at', 'updated_at']);
const PROFILE_KEYS = new Set(['role', 'category', 'task', 'tools', 'model', 'model_variant', 'fallback_models', 'fallback_variants', 'fallback_reasons', 'methodologies', 'permission_profile', 'verification_policy', 'max_context_chars', 'max_handoff_chars', 'max_result_chars', 'max_artifacts', 'expected_turns', 'context_overhead']);
function record(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function strings(v) { return Array.isArray(v) && v.every(x => typeof x === 'string'); }
function finite(v) { return typeof v === 'number' && Number.isFinite(v); }
function validDiff(v) { return record(v) && strings(v.collateral) && v.collateral.every(x => normalizeBoundedProjectPath(x) !== undefined) && strings(v.accepted_expansions) && v.accepted_expansions.every(x => normalizeBoundedProjectPath(x) !== undefined) && (v.native_verified_reverts === undefined || strings(v.native_verified_reverts) && v.native_verified_reverts.every(x => normalizeBoundedProjectPath(x) !== undefined)); }
function validProfile(v) {
    if (!record(v) || !Object.keys(v).every(k => PROFILE_KEYS.has(k)) || typeof v.role !== 'string' || typeof v.category !== 'string' || !CATEGORIES.has(v.category) || !record(v.task) || !strings(v.tools) || !strings(v.fallback_models) || !strings(v.methodologies))
        return false;
    const task = v.task;
    if (typeof task.objective !== 'string' || !strings(task.scope) || !strings(task.dependencies) || !strings(task.required_evidence))
        return false;
    for (const k of ['model', 'model_variant'])
        if (v[k] !== undefined && typeof v[k] !== 'string')
            return false;
    if (v.fallback_variants !== undefined && (!record(v.fallback_variants) || !Object.values(v.fallback_variants).every(x => x === undefined || typeof x === 'string')))
        return false;
    if (v.fallback_reasons !== undefined && (!Array.isArray(v.fallback_reasons) || !v.fallback_reasons.every(x => record(x) && typeof x.model === 'string' && (x.variant === undefined || typeof x.variant === 'string') && typeof x.reason === 'string')))
        return false;
    if (!record(v.permission_profile) || typeof v.permission_profile.skill_tool_enabled !== 'boolean' || !record(v.permission_profile.skill_permissions) || v.permission_profile.external_effects !== 'parent-only' || v.permission_profile.recursive_task !== 'deny')
        return false;
    if (!record(v.verification_policy) || !strings(v.verification_policy.requiredKinds) || typeof v.verification_policy.requireFresh !== 'boolean' || typeof v.verification_policy.requireReview !== 'boolean' || typeof v.verification_policy.allowWorkerReportedEvidence !== 'boolean')
        return false;
    for (const k of ['max_context_chars', 'max_handoff_chars', 'max_result_chars', 'max_artifacts'])
        if (!finite(v[k]))
            return false;
    for (const k of ['expected_turns', 'context_overhead'])
        if (v[k] !== undefined && !finite(v[k]))
            return false;
    return true;
}
export function isTaskContract(v) {
    if (!record(v) || !Object.keys(v).every(k => TASK_KEYS.has(k)) || typeof v.id !== 'string' || typeof v.mission_id !== 'string' || typeof v.objective !== 'string' || typeof v.status !== 'string' || !STATUS.has(v.status) || typeof v.role !== 'string' || typeof v.category !== 'string' || !CATEGORIES.has(v.category))
        return false;
    if (!strings(v.scope) || !strings(v.constraints) || !strings(v.dependencies) || !strings(v.requiredEvidence) || !strings(v.obligation_ids) || !Array.isArray(v.context_artifacts) || !v.context_artifacts.every(isContextReferenceContract) || !strings(v.gate_ids) || !Array.isArray(v.external_action_requirements) || !v.external_action_requirements.every(x => typeof x === 'string' && EXTERNAL.has(x)))
        return false;
    if (v.execution_profile !== undefined && !validProfile(v.execution_profile))
        return false;
    if (v.worker_id !== undefined && typeof v.worker_id !== 'string')
        return false;
    if (v.result !== undefined && !isWorkerResultContract(v.result))
        return false;
    if (v.diff_cleanliness !== undefined && !validDiff(v.diff_cleanliness))
        return false;
    return finite(v.created_at) && finite(v.updated_at) && v.updated_at >= v.created_at;
}
