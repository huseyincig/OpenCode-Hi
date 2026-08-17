import { isExecutionTokenUsage } from './execution-usage.js';
export const COMPARATIVE_BENCHMARK_SCHEMA = 1;
const SYSTEM_KINDS = new Set(['VANILLA_OPENCODE', 'OPENCODE_HI_BASELINE', 'OPENCODE_HI_CURRENT', 'EXTERNAL_BASELINE']);
const EPISODE_KINDS = new Set(['DETERMINISTIC_FIXTURE', 'REAL_HOST_EPISODE', 'POLICY_ABLATION']);
const SCENARIOS = new Set(['trivial-localized-work', 'failing-test-fix', 'independent-parallel-work', 'dependency-fan-in', 'mutable-surface-conflict', 'misleading-done', 'mutation-after-verification', 'provider-child-failure', 'restart-stale-callback', 'authority-ambiguous-replay', 'context-heavy-investigation', 'plugin-config-coexistence', 'production-commit-task']);
const CHECKS = new Set(['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN']);
const RESULTS = new Set(['VERIFIED_SUCCESS', 'VERIFIED_FAILURE', 'BLOCKED_ENVIRONMENT', 'BLOCKED_AUTHORITY', 'TIMEOUT', 'INVALID_RECEIPT']);
const RECEIPT_KEYS = new Set(['schema', 'episode_kind', 'claim_boundary', 'episode_id', 'repetition', 'system', 'task', 'model', 'started_at', 'ended_at', 'deterministic_checks', 'evidence', 'completion_decision', 'failure_injections', 'control_plane', 'economics', 'artifacts', 'result']);
const SYSTEM_KEYS = new Set(['kind', 'label', 'opencode_version', 'opencode_commit', 'hi_commit', 'external_version', 'config_sha256']);
const TASK_KEYS = new Set(['task_id', 'scenario_class', 'fixture_sha256', 'repo', 'from_commit', 'to_commit']);
const MODEL_KEYS = new Set(['requested', 'effective', 'provider_effective']);
const CHECK_KEYS = new Set(['id', 'status', 'exit_code', 'evidence_refs', 'detail']);
const EVIDENCE_KEYS = new Set(['required', 'satisfied', 'fresh', 'stale', 'wrong_task_accepted', 'wrong_attempt_accepted', 'false_completion']);
const CONTROL_KEYS = new Set(['duplicate_dispatch_count', 'stale_callback_accept_count', 'ambiguous_side_effect_replay_count', 'deadlock_or_stall_count', 'orphan_or_cleanup_failure_count', 'workers_spawned', 'retries', 'replans', 'tool_calls', 'model_calls', 'polling_calls', 'peak_concurrent_workers', 'context_bytes_to_children', 'mechanically_identified_redundant_actions']);
const ECON_KEYS = new Set(['wall_time_ms', 'exact_usage', 'estimated_usage', 'provider_billed_cost_usd', 'opencode_derived_cost_usd']);
const EXACT_KEYS = new Set(['tokens', 'coverage', 'source']);
const EST_KEYS = new Set(['tokens', 'cost_usd', 'method']);
const INJECTION_KEYS = new Set(['id', 'kind', 'applied', 'observed']);
const ARTIFACT_KEYS = new Set(['diff_sha256', 'acceptance_log_sha256', 'receipt_inputs_sha256']);
function record(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function exactKeys(v, keys) { return Object.keys(v).every(k => keys.has(k)); }
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
function finiteNonnegative(v) { return typeof v === 'number' && Number.isFinite(v) && v >= 0; }
function integerNonnegative(v) { return Number.isInteger(v) && Number(v) >= 0; }
function sha(v) { return typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v); }
function gitSha(v) { return typeof v === 'string' && /^[a-f0-9]{7,64}$/i.test(v); }
function iso(v) { return typeof v === 'string' && Number.isFinite(Date.parse(v)); }
function strings(v) { return Array.isArray(v) && v.every(nonEmpty); }
function validSystem(v) { if (!record(v) || !exactKeys(v, SYSTEM_KEYS) || !SYSTEM_KINDS.has(String(v.kind)) || !nonEmpty(v.label) || !nonEmpty(v.opencode_version) || !sha(v.config_sha256))
    return false; if (v.opencode_commit !== undefined && !gitSha(v.opencode_commit) || v.hi_commit !== undefined && !gitSha(v.hi_commit) || v.external_version !== undefined && !nonEmpty(v.external_version))
    return false; if (v.kind === 'VANILLA_OPENCODE' && v.hi_commit !== undefined)
    return false; if ((v.kind === 'OPENCODE_HI_BASELINE' || v.kind === 'OPENCODE_HI_CURRENT') && !gitSha(v.hi_commit))
    return false; if (v.kind === 'EXTERNAL_BASELINE' && !nonEmpty(v.external_version))
    return false; return true; }
function validTask(v) { if (!record(v) || !exactKeys(v, TASK_KEYS) || !nonEmpty(v.task_id) || !SCENARIOS.has(String(v.scenario_class)) || !sha(v.fixture_sha256))
    return false; for (const k of ['repo', 'from_commit', 'to_commit'])
    if (v[k] !== undefined && !nonEmpty(v[k]))
        return false; if (v.scenario_class === 'production-commit-task' && (!nonEmpty(v.repo) || !gitSha(v.from_commit) || !gitSha(v.to_commit)))
    return false; return true; }
function validModel(v) { return record(v) && exactKeys(v, MODEL_KEYS) && ['requested', 'effective', 'provider_effective'].every(k => v[k] === undefined || nonEmpty(v[k])); }
function validCheck(v) { if (!record(v) || !exactKeys(v, CHECK_KEYS) || !nonEmpty(v.id) || !CHECKS.has(String(v.status)) || !strings(v.evidence_refs))
    return false; if (v.exit_code !== undefined && !Number.isInteger(v.exit_code) || v.detail !== undefined && !nonEmpty(v.detail))
    return false; if (v.status === 'PASS' && v.evidence_refs.length === 0)
    return false; return true; }
function validEvidence(v) { if (!record(v) || !exactKeys(v, EVIDENCE_KEYS) || !Object.values(v).every(integerNonnegative))
    return false; return Number(v.satisfied) <= Number(v.required) && Number(v.fresh) <= Number(v.satisfied) && Number(v.stale) <= Number(v.satisfied); }
function validControl(v) { return record(v) && exactKeys(v, CONTROL_KEYS) && Object.values(v).every(integerNonnegative); }
function validExactUsage(v) { return record(v) && exactKeys(v, EXACT_KEYS) && isExecutionTokenUsage(v.tokens) && ['COMPLETE_STEP_TOTAL', 'PARTIAL_MESSAGE_REPORTED'].includes(String(v.coverage)) && ['OPENCODE_STEP_FINISH', 'OPENCODE_ASSISTANT_MESSAGE', 'PROVIDER_USAGE'].includes(String(v.source)) && !(v.source === 'OPENCODE_STEP_FINISH' && v.coverage !== 'COMPLETE_STEP_TOTAL'); }
function validEstimated(v) { return record(v) && exactKeys(v, EST_KEYS) && nonEmpty(v.method) && (v.tokens === undefined || finiteNonnegative(v.tokens)) && (v.cost_usd === undefined || finiteNonnegative(v.cost_usd)) && (v.tokens !== undefined || v.cost_usd !== undefined); }
function validEconomics(v) { if (!record(v) || !exactKeys(v, ECON_KEYS) || !finiteNonnegative(v.wall_time_ms))
    return false; if (v.exact_usage !== undefined && !validExactUsage(v.exact_usage) || v.estimated_usage !== undefined && !validEstimated(v.estimated_usage))
    return false; if (v.provider_billed_cost_usd !== undefined && !finiteNonnegative(v.provider_billed_cost_usd) || v.opencode_derived_cost_usd !== undefined && !finiteNonnegative(v.opencode_derived_cost_usd))
    return false; return true; }
function validInjection(v) { return record(v) && exactKeys(v, INJECTION_KEYS) && nonEmpty(v.id) && nonEmpty(v.kind) && typeof v.applied === 'boolean' && typeof v.observed === 'boolean' && (!v.observed || v.applied); }
function validArtifacts(v) { return record(v) && exactKeys(v, ARTIFACT_KEYS) && sha(v.receipt_inputs_sha256) && (v.diff_sha256 === undefined || sha(v.diff_sha256)) && (v.acceptance_log_sha256 === undefined || sha(v.acceptance_log_sha256)); }
export function isComparativeBenchmarkReceipt(v) {
    if (!record(v) || !exactKeys(v, RECEIPT_KEYS) || v.schema !== COMPARATIVE_BENCHMARK_SCHEMA || !EPISODE_KINDS.has(String(v.episode_kind)) || !nonEmpty(v.claim_boundary) || !nonEmpty(v.episode_id) || !Number.isInteger(v.repetition) || Number(v.repetition) < 1)
        return false;
    if (!validSystem(v.system) || !validTask(v.task) || !validModel(v.model) || !iso(v.started_at) || !iso(v.ended_at) || Date.parse(String(v.ended_at)) < Date.parse(String(v.started_at)))
        return false;
    if (!Array.isArray(v.deterministic_checks) || !v.deterministic_checks.every(validCheck) || !validEvidence(v.evidence) || !nonEmpty(v.completion_decision) || !Array.isArray(v.failure_injections) || !v.failure_injections.every(validInjection) || !validControl(v.control_plane) || !validEconomics(v.economics) || !validArtifacts(v.artifacts) || !RESULTS.has(String(v.result)))
        return false;
    if (v.result === 'VERIFIED_SUCCESS' && (v.deterministic_checks.some((x) => x.status !== 'PASS') || v.evidence.false_completion !== 0 || v.control_plane.ambiguous_side_effect_replay_count !== 0))
        return false;
    if (v.episode_kind === 'POLICY_ABLATION' && !/ablation|simulation|policy/i.test(String(v.claim_boundary)))
        return false;
    return true;
}
