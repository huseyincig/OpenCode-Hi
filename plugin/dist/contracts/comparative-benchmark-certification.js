import { createHash } from 'node:crypto';
import { stableJson } from './common.js';
import { isComparativeBenchmarkReceipt } from './comparative-benchmark.js';
export const COMPARATIVE_BENCHMARK_CERTIFICATION_SCHEMA = 1;
const SHA = /^[a-f0-9]{64}$/i;
const GIT_SHA = /^[a-f0-9]{7,64}$/i;
const VERDICTS = new Set(['NO_REGRESSION', 'STABLE_REGRESSION', 'FLAKY', 'BLOCKED_ENVIRONMENT', 'BLOCKED_AUTHORITY', 'INCONCLUSIVE']);
const ATTRIBUTIONS = new Set(['SOURCE_CHANGED', 'FIXTURE_CHANGED', 'CONFIG_CHANGED', 'HOST_CHANGED', 'MODEL_CHANGED', 'RUNTIME_CHANGED', 'UNKNOWN_DRIFT']);
const SERIES_KEYS = new Set(['schema', 'series_id', 'claim_boundary', 'baseline', 'current', 'stability', 'environment_stable', 'environment_delta', 'attribution', 'verdict']);
const SAMPLE_KEYS = new Set(['receipt_sha256', 'episode_id', 'repetition', 'episode_kind', 'result', 'outcome_sha256', 'environment']);
const ENV_KEYS = new Set(['source_inputs_sha256', 'fixture_sha256', 'config_sha256', 'opencode_version', 'opencode_commit', 'model_requested', 'model_effective', 'provider_effective', 'platform', 'node_version']);
const STABILITY_KEYS = new Set(['required_samples', 'observed_samples', 'performed', 'stable', 'outcome_hashes']);
const DELTA_KEYS = new Set(['keys_changed', 'details']);
const ATTR_KEYS = new Set(['top', 'also_observed', 'reliable', 'reason', 'evidence']);
const ENV_ORDER = [...ENV_KEYS];
const CLASS_PRIORITY = ['SOURCE_CHANGED', 'FIXTURE_CHANGED', 'CONFIG_CHANGED', 'HOST_CHANGED', 'MODEL_CHANGED', 'RUNTIME_CHANGED'];
const CLASS_BY_ENV_KEY = {
    source_inputs_sha256: 'SOURCE_CHANGED',
    fixture_sha256: 'FIXTURE_CHANGED',
    config_sha256: 'CONFIG_CHANGED',
    opencode_version: 'HOST_CHANGED', opencode_commit: 'HOST_CHANGED',
    model_requested: 'MODEL_CHANGED', model_effective: 'MODEL_CHANGED', provider_effective: 'MODEL_CHANGED',
    platform: 'RUNTIME_CHANGED', node_version: 'RUNTIME_CHANGED',
};
function record(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function exactKeys(v, keys) { return Object.keys(v).every(k => keys.has(k)); }
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
function integer(v) { return Number.isInteger(v) && Number(v) >= 0; }
function hash(value) { return createHash('sha256').update(stableJson(value)).digest('hex'); }
function outcomeProjection(receipt) {
    return {
        result: receipt.result,
        completion_decision: receipt.completion_decision,
        deterministic_checks: [...receipt.deterministic_checks].map(check => ({ id: check.id, status: check.status, ...(check.exit_code === undefined ? {} : { exit_code: check.exit_code }) })).sort((a, b) => a.id.localeCompare(b.id)),
        evidence: { ...receipt.evidence },
        failure_injections: [...receipt.failure_injections].map(item => ({ id: item.id, kind: item.kind, applied: item.applied, observed: item.observed })).sort((a, b) => a.id.localeCompare(b.id)),
        safety: {
            duplicate_dispatch_count: receipt.control_plane.duplicate_dispatch_count,
            stale_callback_accept_count: receipt.control_plane.stale_callback_accept_count,
            ambiguous_side_effect_replay_count: receipt.control_plane.ambiguous_side_effect_replay_count,
            deadlock_or_stall_count: receipt.control_plane.deadlock_or_stall_count,
            orphan_or_cleanup_failure_count: receipt.control_plane.orphan_or_cleanup_failure_count,
        },
    };
}
function environmentFrom(input) {
    if (!isComparativeBenchmarkReceipt(input.receipt))
        throw new Error('comparative benchmark certification sample requires a valid ComparativeBenchmarkReceipt');
    if (!SHA.test(input.environment.source_inputs_sha256))
        throw new Error('source_inputs_sha256 must be an exact SHA-256');
    for (const key of ['platform', 'node_version'])
        if (input.environment[key] !== undefined && !nonEmpty(input.environment[key]))
            throw new Error(`${key} must be non-empty when supplied`);
    const r = input.receipt;
    return {
        source_inputs_sha256: input.environment.source_inputs_sha256,
        fixture_sha256: r.task.fixture_sha256,
        config_sha256: r.system.config_sha256,
        opencode_version: r.system.opencode_version,
        ...(r.system.opencode_commit ? { opencode_commit: r.system.opencode_commit } : {}),
        ...(r.model.requested ? { model_requested: r.model.requested } : {}),
        ...(r.model.effective ? { model_effective: r.model.effective } : {}),
        ...(r.model.provider_effective ? { provider_effective: r.model.provider_effective } : {}),
        ...(input.environment.platform ? { platform: input.environment.platform } : {}),
        ...(input.environment.node_version ? { node_version: input.environment.node_version } : {}),
    };
}
function sampleFrom(input) {
    const receipt = input.receipt;
    if (!isComparativeBenchmarkReceipt(receipt))
        throw new Error('comparative benchmark certification sample requires a valid ComparativeBenchmarkReceipt');
    return { receipt_sha256: hash(receipt), episode_id: receipt.episode_id, repetition: receipt.repetition, episode_kind: receipt.episode_kind, result: receipt.result, outcome_sha256: hash(outcomeProjection(receipt)), environment: environmentFrom(input) };
}
function envValue(environment, key) { return environment[key]; }
function diffEnvironment(baseline, current) {
    const keys = ENV_ORDER.filter(key => envValue(baseline, key) !== envValue(current, key));
    const details = {};
    for (const key of keys)
        details[key] = { ...(envValue(baseline, key) === undefined ? {} : { baseline: envValue(baseline, key) }), ...(envValue(current, key) === undefined ? {} : { current: envValue(current, key) }) };
    return { keys_changed: keys, details };
}
function sameEnvironment(a, b) { return stableJson(a) === stableJson(b); }
function attributionFor(delta, reliableContext, contextReason) {
    const observed = [...new Set(delta.keys_changed.map(key => CLASS_BY_ENV_KEY[key]).filter((value) => Boolean(value)))];
    const ordered = CLASS_PRIORITY.filter(value => observed.includes(value));
    const top = ordered[0] ?? 'UNKNOWN_DRIFT', also = ordered.slice(1);
    if (!reliableContext)
        return { top, also_observed: also, reliable: false, reason: contextReason, evidence: delta };
    if (ordered.length > 1)
        return { top, also_observed: also, reliable: false, reason: 'Multiple environment classes changed; causal attribution is not singular.', evidence: delta };
    return { top, also_observed: also, reliable: true, reason: top === 'UNKNOWN_DRIFT' ? 'Stable failure with no classified environment delta; cause remains unknown.' : 'Stable failure with one classified environment delta.', evidence: delta };
}
function isFailureResult(result) { return result === 'VERIFIED_FAILURE' || result === 'TIMEOUT'; }
function ensureComparable(baseline, current) {
    const seen = new Set();
    for (const r of current) {
        if (r.task.task_id !== baseline.task.task_id || r.task.scenario_class !== baseline.task.scenario_class)
            throw new Error('certification samples must bind the same task_id and scenario_class as baseline');
        if (r.system.kind !== baseline.system.kind)
            throw new Error('certification samples must bind the same system kind as baseline');
        if (seen.has(r.repetition))
            throw new Error(`duplicate repetition ${r.repetition} in certification samples`);
        seen.add(r.repetition);
    }
}
export function buildComparativeBenchmarkCertificationSeries(input) {
    if (!nonEmpty(input.series_id) || !nonEmpty(input.claim_boundary))
        throw new Error('certification series requires non-empty series_id and claim_boundary');
    if (!isComparativeBenchmarkReceipt(input.baseline.receipt))
        throw new Error('certification baseline requires a valid ComparativeBenchmarkReceipt');
    if (!Array.isArray(input.current) || input.current.length === 0)
        throw new Error('certification series requires at least one current sample');
    for (const item of input.current)
        if (!isComparativeBenchmarkReceipt(item.receipt))
            throw new Error('certification current sample requires a valid ComparativeBenchmarkReceipt');
    ensureComparable(input.baseline.receipt, input.current.map(item => item.receipt));
    const baseline = sampleFrom(input.baseline), current = input.current.map(sampleFrom).sort((a, b) => a.repetition - b.repetition);
    const environmentStable = current.every(sample => sameEnvironment(sample.environment, current[0].environment));
    const environmentDelta = diffEnvironment(baseline.environment, current[0].environment);
    const outcomes = current.map(sample => sample.outcome_sha256), outcomeStable = outcomes.every(value => value === outcomes[0]);
    const results = current.map(sample => sample.result), all = (value) => results.every(result => result === value);
    const failureObserved = results.some(isFailureResult);
    const deterministic = current.every(sample => sample.episode_kind === 'DETERMINISTIC_FIXTURE');
    const requiredSamples = failureObserved && !deterministic ? 3 : 1;
    const observedSamples = current.length;
    const performed = requiredSamples > 1 && observedSamples >= requiredSamples;
    const stable = deterministic ? outcomeStable : (failureObserved && observedSamples >= requiredSamples ? outcomeStable : true);
    const stability = { required_samples: requiredSamples, observed_samples: observedSamples, performed, stable, outcome_hashes: outcomes };
    let verdict = 'INCONCLUSIVE', reliableContext = false, reason = 'Series does not establish a stable regression.';
    if (input.baseline.receipt.result !== 'VERIFIED_SUCCESS') {
        reason = 'Baseline is not VERIFIED_SUCCESS; regression comparison is inconclusive.';
    }
    else if (results.some(result => result === 'INVALID_RECEIPT')) {
        reason = 'At least one current sample is INVALID_RECEIPT.';
    }
    else if (all('BLOCKED_ENVIRONMENT')) {
        verdict = 'BLOCKED_ENVIRONMENT';
        reason = 'Current episode is blocked by environment, not classified as a product regression.';
    }
    else if (all('BLOCKED_AUTHORITY')) {
        verdict = 'BLOCKED_AUTHORITY';
        reason = 'Current episode is blocked by authority, not classified as a product regression.';
    }
    else if (results.some(result => result === 'BLOCKED_ENVIRONMENT' || result === 'BLOCKED_AUTHORITY')) {
        reason = 'Current samples mix blocked and executable outcomes.';
    }
    else if (all('VERIFIED_SUCCESS')) {
        verdict = 'NO_REGRESSION';
        reason = 'All observed current samples are VERIFIED_SUCCESS.';
    }
    else if (!environmentStable) {
        reason = 'Environment identity changed between current stability samples.';
    }
    else if (failureObserved && observedSamples < requiredSamples) {
        reason = `Failure requires ${requiredSamples} samples; observed ${observedSamples}.`;
    }
    else if (!outcomeStable) {
        verdict = 'FLAKY';
        reason = 'Current sample outcome fingerprints diverged.';
    }
    else if (results.every(isFailureResult)) {
        verdict = 'STABLE_REGRESSION';
        reliableContext = true;
        reason = 'Failure outcome is stable under the required sample policy.';
    }
    else {
        reason = 'Current samples do not form a single stable success, blocked state, or failure class.';
    }
    const attribution = attributionFor(environmentDelta, reliableContext, reason);
    return { schema: COMPARATIVE_BENCHMARK_CERTIFICATION_SCHEMA, series_id: input.series_id, claim_boundary: input.claim_boundary, baseline, current, stability, environment_stable: environmentStable, environment_delta: environmentDelta, attribution, verdict };
}
function validEnvironment(v) {
    if (!record(v) || !exactKeys(v, ENV_KEYS) || !SHA.test(String(v.source_inputs_sha256)) || !SHA.test(String(v.fixture_sha256)) || !SHA.test(String(v.config_sha256)) || !nonEmpty(v.opencode_version))
        return false;
    if (v.opencode_commit !== undefined && !GIT_SHA.test(String(v.opencode_commit)))
        return false;
    for (const key of ['model_requested', 'model_effective', 'provider_effective', 'platform', 'node_version'])
        if (v[key] !== undefined && !nonEmpty(v[key]))
            return false;
    return true;
}
function validSample(v) { return record(v) && exactKeys(v, SAMPLE_KEYS) && SHA.test(String(v.receipt_sha256)) && nonEmpty(v.episode_id) && Number.isInteger(v.repetition) && Number(v.repetition) >= 1 && ['DETERMINISTIC_FIXTURE', 'REAL_HOST_EPISODE', 'POLICY_ABLATION'].includes(String(v.episode_kind)) && ['VERIFIED_SUCCESS', 'VERIFIED_FAILURE', 'BLOCKED_ENVIRONMENT', 'BLOCKED_AUTHORITY', 'TIMEOUT', 'INVALID_RECEIPT'].includes(String(v.result)) && SHA.test(String(v.outcome_sha256)) && validEnvironment(v.environment); }
function validDelta(v) {
    if (!record(v) || !exactKeys(v, DELTA_KEYS) || !Array.isArray(v.keys_changed) || !record(v.details))
        return false;
    const keys = v.keys_changed;
    if (!keys.every((key) => typeof key === 'string' && ENV_KEYS.has(key)) || new Set(keys).size !== keys.length)
        return false;
    if (Object.keys(v.details).some(key => !keys.includes(key)))
        return false;
    return Object.entries(v.details).every(([, detail]) => record(detail) && Object.keys(detail).every(key => ['baseline', 'current'].includes(key)) && Object.values(detail).every(value => value === undefined || typeof value === 'string'));
}
function validStability(v) { return record(v) && exactKeys(v, STABILITY_KEYS) && integer(v.required_samples) && Number(v.required_samples) >= 1 && integer(v.observed_samples) && Number(v.observed_samples) >= 1 && typeof v.performed === 'boolean' && typeof v.stable === 'boolean' && Array.isArray(v.outcome_hashes) && v.outcome_hashes.length === v.observed_samples && v.outcome_hashes.every(value => typeof value === 'string' && SHA.test(value)); }
function isAttributionClass(v) { return typeof v === 'string' && ATTRIBUTIONS.has(v); }
function isVerdict(v) { return typeof v === 'string' && VERDICTS.has(v); }
function validAttribution(v) { return record(v) && exactKeys(v, ATTR_KEYS) && isAttributionClass(v.top) && Array.isArray(v.also_observed) && v.also_observed.every(isAttributionClass) && typeof v.reliable === 'boolean' && nonEmpty(v.reason) && validDelta(v.evidence); }
export function isComparativeBenchmarkCertificationSeries(v) {
    if (!record(v) || !exactKeys(v, SERIES_KEYS) || v.schema !== COMPARATIVE_BENCHMARK_CERTIFICATION_SCHEMA || !nonEmpty(v.series_id) || !nonEmpty(v.claim_boundary) || !validSample(v.baseline) || !Array.isArray(v.current) || v.current.length === 0 || !v.current.every(validSample) || !validStability(v.stability) || typeof v.environment_stable !== 'boolean' || !validDelta(v.environment_delta) || !validAttribution(v.attribution) || !isVerdict(v.verdict))
        return false;
    if (stableJson(v.environment_delta) !== stableJson(v.attribution.evidence))
        return false;
    if (new Set(v.current.map(sample => sample.repetition)).size !== v.current.length)
        return false;
    if (v.verdict === 'STABLE_REGRESSION' && (!v.stability.stable || !v.attribution.reliable && v.attribution.also_observed.length === 0 && v.attribution.top !== 'UNKNOWN_DRIFT'))
        return false;
    return true;
}
