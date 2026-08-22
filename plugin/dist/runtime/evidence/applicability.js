import { executionAttemptIdentity } from "../../contracts/orchestration-core.js";
import { isHiReviewerRole } from "../roles/catalog.js";
export function evidenceProducerAttemptForWorker(m, worker) {
    const identity = executionAttemptIdentity({ executionUnitId: `eu:${worker.task_id}`, workerId: worker.id, ordinal: worker.attempt ?? 0, generation: worker.generation_at_spawn ?? m.continuation.generation });
    return { worker_id: worker.id, execution_unit_id: identity.executionUnitId, attempt_id: identity.attemptId, run_id: identity.runId, ordinal: identity.ordinal, generation: identity.generation };
}
function workerSource(e) { return String(e.source ?? "").startsWith("worker:"); }
function reviewerObservation(e) { return e.trusted_source_class === 'reviewer-observation' || String(e.source ?? '').startsWith('reviewer:'); }
function exactProducer(m, e) {
    const reasons = [], p = e.producer_attempt, isWorker = workerSource(e), isReviewer = reviewerObservation(e), requiresProducer = isWorker || isReviewer;
    if (isWorker && (!e.source_session_id || !e.source_state_hash || !/^[a-f0-9]{64}$/i.test(e.source_state_hash)))
        reasons.push("worker-source-state-unbound");
    if (isReviewer && (!e.source_session_id || !e.source_state_hash || !/^[a-f0-9]{64}$/i.test(e.source_state_hash)))
        reasons.push("reviewer-source-state-unbound");
    if (!p)
        return requiresProducer ? [...reasons, isReviewer ? "reviewer-attempt-unbound" : "worker-attempt-unbound"] : reasons;
    if (!e.source_session_id)
        reasons.push("producer-session-unbound");
    const worker = m.execution.workers.find(w => w.id === p.worker_id);
    if (!worker)
        return [...reasons, "producer-worker-missing"];
    if (isReviewer) {
        if (!isHiReviewerRole(worker.role))
            reasons.push("reviewer-role-mismatch");
        if (e.source !== `reviewer:${worker.id}`)
            reasons.push("reviewer-source-mismatch");
        if (!worker.native_state_hash || e.source_state_hash !== worker.native_state_hash)
            reasons.push("reviewer-state-mismatch");
    }
    if (e.task_id !== worker.task_id)
        reasons.push("producer-task-mismatch");
    if (e.source_session_id !== worker.session_id)
        reasons.push("producer-session-mismatch");
    const expected = executionAttemptIdentity({ executionUnitId: `eu:${worker.task_id}`, workerId: worker.id, ordinal: worker.attempt ?? 0, generation: worker.generation_at_spawn ?? m.continuation.generation });
    if (p.execution_unit_id !== expected.executionUnitId || p.attempt_id !== expected.attemptId || p.run_id !== expected.runId || p.ordinal !== expected.ordinal || p.generation !== expected.generation)
        reasons.push("producer-attempt-mismatch");
    return reasons;
}
/** Claim identity only. Freshness/invalidation is evaluated separately. */
export function evidenceClaimApplicability(m, e, obligationID) {
    const reasons = exactProducer(m, e);
    if (obligationID) {
        if (!e.obligation_ids?.includes(obligationID))
            reasons.push("obligation-mismatch");
        const ownerTasks = m.execution.tasks.filter(t => t.obligation_ids.includes(obligationID)).map(t => t.id);
        if (ownerTasks.length && e.task_id && !ownerTasks.includes(e.task_id))
            reasons.push("task-mismatch");
        if (ownerTasks.length && workerSource(e) && !e.task_id)
            reasons.push("task-unbound");
    }
    return { applicable: reasons.length === 0, reasons: [...new Set(reasons)] };
}
