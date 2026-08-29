function fnv(value) { let h = 2166136261; for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
} return (h >>> 0).toString(16).padStart(8, '0'); }
function failureClass(value) {
    const x = value.toLowerCase();
    const known = [
        [/worker-result-contract(?:-invalid|-retry)?/, 'worker-result-contract'], [/source-provenance-claim-missing|exploration-clearance/, 'exploration-clearance'],
        [/review-verdict|required.*review-evidence|review-evidence.*required/, 'review-verdict'], [/methodology-exit/, 'methodology-exit'], [/diff-cleanliness|cleanup-(?:unverified|not-reverted)/, 'diff-cleanliness'],
        [/verification-coverage|visual-evidence-ref-correction/, 'verification-coverage'], [/capability-unavailable/, 'capability-unavailable'], [/provider-failure/, 'provider-failure'],
        [/dependency-(?:outcome|unavailable)/, 'dependency-outcome'], [/runtime-restart/, 'runtime-restart'], [/permission-denied/, 'permission-denied'],
    ];
    for (const [pattern, label] of known)
        if (pattern.test(x))
            return label;
    return x.replace(/(?:t|w|ev|bo|msg|ses)_[a-z0-9_-]+/g, '<id>').replace(/[a-f0-9]{16,}/g, '<id>').replace(/\d+/g, '#').replace(/[^a-z0-9<>#-]+/g, ' ').trim().split(/\s+/).slice(0, 12).join('-') || 'unspecified';
}
function currentResultFailureSignature(m, worker) {
    const resolved = worker ?? latestRecoveryWorker(m), task = resolved ? m.execution.tasks.find(t => t.id === resolved.task_id) : undefined, result = task?.result;
    if (!result || result.status === 'DONE')
        return undefined;
    const classes = [...new Set([...(result.open_issues ?? []), ...(result.needs_context ?? [])].map(x => failureClass(String(x))).filter(Boolean))].sort();
    return fnv(JSON.stringify({ status: result.status, classes }));
}
export function recoveryResultFailureSignature(m) { return currentResultFailureSignature(m); }
/** Recovery identity deliberately ignores activity-only churn such as worker status/attempt counters. */
export function recoverySemanticSignature(m) {
    const s = m.continuation.semantic_progress_snapshot;
    if (!s)
        return m.continuation.last_progress_signature || '00000000';
    return fnv(JSON.stringify({ evidence: s.evidence_ids, invalidated: s.invalidated_evidence_ids, completed_tasks: s.completed_task_ids, completed_dependencies: s.completed_dependency_ids, closed_obligations: s.closed_obligation_ids, changed_files: s.changed_files, terminal_processes: s.terminal_process_ids }));
}
function currentProgressSignature(m) { return recoverySemanticSignature(m); }
function latestRecoveryWorker(m) { return [...m.execution.workers].reverse().find(w => { if (!w.session_id || ['failed', 'cancelled', 'busy', 'starting', 'queued'].includes(w.status))
    return false; const task = m.execution.tasks.find(t => t.id === w.task_id); if (!task || task.status === 'completed' || task.result?.status === 'DONE')
    return false; if (task.obligation_ids.length && task.obligation_ids.every(id => m.execution.obligations.some(o => o.id === id && o.status === 'closed')))
    return false; return true; }); }
function candidateModels(worker) { const attempted = new Set(); if (worker.model)
    attempted.add(worker.model); for (const transition of worker.fallback_history ?? []) {
    if (transition.from)
        attempted.add(transition.from);
    if (transition.to)
        attempted.add(transition.to);
} return [...new Set([...(worker.fallbacks ?? []), ...(worker.recovery_candidates ?? [])].filter(id => Boolean(id) && !attempted.has(id)))]; }
export function recoveryModelHazard(m) {
    const progress_signature = currentProgressSignature(m), worker = latestRecoveryWorker(m), task = worker ? m.execution.tasks.find(t => t.id === worker.task_id) : undefined;
    if (!worker || !task || !worker.model)
        return { open: false, same_model_exhausted: false, cross_model_exhausted: false, reason: 'no-recoverable-model-worker', progress_signature, attempts: 0, recovery_candidates: [] };
    const failure_signature = currentResultFailureSignature(m, worker), recovery_candidates = candidateModels(worker), history = (m.continuation.recovery_history ?? []).filter(item => item.generation === m.continuation.generation && item.progress_signature === progress_signature && item.outcome !== 'failed' && item.task_id === task.id && item.worker_id === worker.id && item.failure_signature === failure_signature);
    const attempts = failure_signature ? history.filter(item => item.action === 'same-worker-resume' && item.model === worker.model).length : 0, cross_model_exhausted = Boolean(failure_signature && history.some(item => item.action === 'model-escalation'));
    const same_model_exhausted = attempts >= 1 || cross_model_exhausted;
    if (cross_model_exhausted)
        return { open: false, same_model_exhausted: true, cross_model_exhausted: true, reason: 'model-escalation-reproduced-same-failure-without-semantic-delta', task_id: task.id, worker_id: worker.id, model: worker.model, progress_signature, failure_signature, attempts, recovery_candidates: [] };
    if (worker.requested_model && !worker.fallbacks.length)
        return { open: false, same_model_exhausted, cross_model_exhausted: false, reason: same_model_exhausted ? 'explicit-task-model-same-failure-correction-exhausted' : 'explicit-task-model-has-no-authorized-fallback', task_id: task.id, worker_id: worker.id, model: worker.model, progress_signature, failure_signature, attempts, recovery_candidates: [] };
    if (!recovery_candidates.length)
        return { open: false, same_model_exhausted, cross_model_exhausted: false, reason: same_model_exhausted ? 'same-model-same-failure-correction-exhausted-no-candidate' : 'no-recovery-model-candidate', task_id: task.id, worker_id: worker.id, model: worker.model, progress_signature, failure_signature, attempts, recovery_candidates };
    return { open: same_model_exhausted, same_model_exhausted, cross_model_exhausted: false, reason: same_model_exhausted ? 'same-model-same-failure-correction-exhausted' : 'same-model-correction-not-exhausted', task_id: task.id, worker_id: worker.id, model: worker.model, progress_signature, failure_signature, attempts, recovery_candidates };
}
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
    const worker = latestRecoveryWorker(m), task = worker ? m.execution.tasks.find(t => t.id === worker.task_id) : undefined, failure_signature = currentResultFailureSignature(m, worker);
    if (plan.action === 'same-worker-resume' && worker?.model && task && failure_signature) {
        const crossModelRepeated = (m.continuation.recovery_history ?? []).some(item => item.generation === m.continuation.generation && item.progress_signature === progress_signature && item.action === 'model-escalation' && item.outcome !== 'failed' && item.task_id === task.id && item.worker_id === worker.id && item.failure_signature === failure_signature);
        if (crossModelRepeated)
            return { allowed: false, reason: 'model-escalation-reproduced-same-failure-without-semantic-delta', fingerprint, progress_signature };
        const equivalent = (m.continuation.recovery_history ?? []).some(item => item.generation === m.continuation.generation && item.progress_signature === progress_signature && item.action === 'same-worker-resume' && item.outcome !== 'failed' && item.task_id === task.id && item.worker_id === worker.id && item.model === worker.model && item.failure_signature === failure_signature);
        if (equivalent)
            return { allowed: false, reason: 'same-failure-same-model-correction-repeated-without-semantic-delta', fingerprint, progress_signature };
    }
    const repeated = (m.continuation.recovery_history ?? []).some(item => item.fingerprint === fingerprint && item.progress_signature === progress_signature && item.outcome !== 'failed');
    return repeated ? { allowed: false, reason: 'strategy-repeated-without-semantic-delta', fingerprint, progress_signature } : { allowed: true, reason: 'strategy-admissible', fingerprint, progress_signature };
}
export function recordRecoveryStrategy(m, plan, outcome = 'started', at = Date.now(), context = {}) {
    const worker = latestRecoveryWorker(m), task = worker ? m.execution.tasks.find(t => t.id === worker.task_id) : undefined, inferred = worker ? { task_id: task?.id, worker_id: worker.id, model: worker.model, failure_signature: currentResultFailureSignature(m, worker) } : {};
    const record = { fingerprint: recoveryStrategyFingerprint(m, plan), level: plan.level, action: plan.action, progress_signature: currentProgressSignature(m), generation: m.continuation.generation, attempted_at: at, outcome, ...inferred, ...context };
    const history = [...(m.continuation.recovery_history ?? []), record];
    m.continuation.recovery_history = history.slice(-24);
    return record;
}
export function isRecoveryStrategyRecord(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v))
        return false;
    const x = v, keys = ['fingerprint', 'level', 'action', 'progress_signature', 'generation', 'attempted_at', 'outcome', 'task_id', 'worker_id', 'model', 'failure_signature'];
    if (Object.keys(x).some(k => !keys.includes(k)))
        return false;
    if (!['task_id', 'worker_id', 'model', 'failure_signature'].every(k => x[k] === undefined || typeof x[k] === 'string'))
        return false;
    return typeof x.fingerprint === 'string' && /^rg1:[a-f0-9]{8}$/.test(x.fingerprint) && Number.isInteger(x.level) && Number(x.level) >= 0 && Number(x.level) <= 6 && ['continue', 'same-worker-resume', 'model-escalation', 'narrow-task', 'alternate-plan', 'fresh-worker', 'user-action'].includes(String(x.action)) && typeof x.progress_signature === 'string' && /^[a-f0-9]{8}$/.test(x.progress_signature) && Number.isInteger(x.generation) && Number(x.generation) >= 1 && typeof x.attempted_at === 'number' && Number.isFinite(x.attempted_at) && ['started', 'completed', 'failed'].includes(String(x.outcome));
}
