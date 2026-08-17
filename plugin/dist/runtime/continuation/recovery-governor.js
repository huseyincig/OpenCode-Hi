function fnv(value) { let h = 2166136261; for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
} return (h >>> 0).toString(16).padStart(8, '0'); }
function currentProgressSignature(m) { return m.continuation.semantic_progress_snapshot?.state_hash ?? m.continuation.last_progress_signature; }
export function recoveryStrategyFingerprint(m, plan) { return `rg1:${fnv(JSON.stringify({ generation: m.continuation.generation, level: plan.level, action: plan.action }))}`; }
export function ambiguousConsequentialEffect(m) {
    if (m.authority?.authority?.executing)
        return 'authority-execution-in-flight';
    const chain = m.release?.release_chain;
    if (chain?.push?.outcome === 'unknown' && !chain.push.remote_verified)
        return 'release-push-outcome-unknown';
    if (chain?.tag_push?.outcome === 'unknown' && !chain.tag_push.remote_verified)
        return 'release-tag-push-outcome-unknown';
    if (chain?.release?.outcome === 'unknown' && !chain.release.remote_verified)
        return 'release-create-outcome-unknown';
    if (chain?.package?.outcome === 'unknown' && !chain.package.remote_verified)
        return 'package-publish-outcome-unknown';
    return undefined;
}
export function recoveryStrategyEligibility(m, plan) {
    const fingerprint = recoveryStrategyFingerprint(m, plan), progress_signature = currentProgressSignature(m), ambiguous = ambiguousConsequentialEffect(m);
    if (ambiguous)
        return { allowed: false, reason: ambiguous, fingerprint, progress_signature };
    const repeated = (m.continuation.recovery_history ?? []).some(item => item.fingerprint === fingerprint && item.progress_signature === progress_signature && item.outcome !== 'failed');
    return repeated ? { allowed: false, reason: 'strategy-repeated-without-semantic-delta', fingerprint, progress_signature } : { allowed: true, reason: 'strategy-admissible', fingerprint, progress_signature };
}
export function recordRecoveryStrategy(m, plan, outcome = 'started', at = Date.now()) {
    const record = { fingerprint: recoveryStrategyFingerprint(m, plan), level: plan.level, action: plan.action, progress_signature: currentProgressSignature(m), generation: m.continuation.generation, attempted_at: at, outcome };
    const history = [...(m.continuation.recovery_history ?? []), record];
    m.continuation.recovery_history = history.slice(-24);
    return record;
}
export function isRecoveryStrategyRecord(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v))
        return false;
    const x = v, keys = ['fingerprint', 'level', 'action', 'progress_signature', 'generation', 'attempted_at', 'outcome'];
    if (Object.keys(x).some(k => !keys.includes(k)) || Object.keys(x).length !== keys.length)
        return false;
    return typeof x.fingerprint === 'string' && /^rg1:[a-f0-9]{8}$/.test(x.fingerprint) && Number.isInteger(x.level) && Number(x.level) >= 0 && Number(x.level) <= 6 && ['continue', 'same-worker-resume', 'model-escalation', 'narrow-task', 'alternate-plan', 'fresh-worker', 'user-action'].includes(String(x.action)) && typeof x.progress_signature === 'string' && /^[a-f0-9]{8}$/.test(x.progress_signature) && Number.isInteger(x.generation) && Number(x.generation) >= 1 && typeof x.attempted_at === 'number' && Number.isFinite(x.attempted_at) && ['started', 'completed', 'failed'].includes(String(x.outcome));
}
