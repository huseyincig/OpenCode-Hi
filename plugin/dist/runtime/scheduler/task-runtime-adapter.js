import { createSchedulerLifecycleState, executionAttemptIdentity } from '../../contracts/orchestration-core.js';
import { projectMissionToWorkGraph } from '../execution/work-graph-projection.js';
import { isHiReadOnlyChildRole } from '../roles/catalog.js';
import { planSchedulerAdmissions, reduceSchedulerLifecycle, reserveSchedulerUnit } from './lifecycle.js';
import { planScheduling } from './planner.js';
import { EMPTY_PROJECT_SCHEDULING_PEER_VIEW } from './project-peer-view.js';
function providerOf(model) { return model && model !== 'host-default' && model.includes('/') ? model.slice(0, model.indexOf('/')) : undefined; }
function unitID(worker) { return `eu:${worker.task_id}`; }
function lifecycle(m) { return m.execution.scheduler ?? (m.execution.scheduler = createSchedulerLifecycleState(m.identity.mission_id)); }
export function taskRuntimeSchedulingSnapshot(m, scheduler, override, peerView = EMPTY_PROJECT_SCHEDULING_PEER_VIEW) {
    const graph = projectMissionToWorkGraph(m, Date.now()), unitTraits = {}, resolvedResources = {};
    if (override?.resumeTaskId) {
        const task = m.execution.tasks.find(item => item.id === override.resumeTaskId), worker = m.execution.workers.find(item => item.id === override.workerId && item.task_id === override.resumeTaskId);
        const resumable = Boolean(task && worker && worker.status === 'ready' && worker.session_id && task.worker_id === worker.id && task.result && ['FIX_REQUIRED', 'NEEDS_CONTEXT', 'BLOCKED'].includes(task.result.status));
        if (resumable) {
            const node = graph.nodes.find(item => item.id === override.resumeTaskId);
            // Durable BLOCKED describes the previous attempt result. Only an explicit exact-task resume
            // projects that retained node as scheduler-waiting so normal dependency/conflict/capacity
            // policy can decide whether the next attempt may start. Durable task state remains unchanged.
            if (node)
                node.status = 'waiting';
        }
    }
    for (const unit of graph.executionUnits) {
        const worker = m.execution.workers.find(item => item.task_id === unit.workNodeId), current = worker?.id === override?.workerId, pending = Boolean(worker && ['created', 'queued', 'starting'].includes(worker.status));
        unitTraits[unit.id] = { readOnly: isHiReadOnlyChildRole(unit.role), admissionEligible: current || pending };
    }
    for (const worker of m.execution.workers) {
        const model = worker.id === override?.workerId ? override.model : worker.model, unit = unitID(worker);
        resolvedResources[unit] = { ...(providerOf(model) ? { provider: providerOf(model) } : {}), ...(model && model !== 'host-default' ? { model } : {}) };
    }
    const policy = scheduler.policySnapshot(), running = [...lifecycle(m).reservations.map(reservation => ({ executionUnitId: reservation.executionUnitId, ...(reservation.resource.provider ? { provider: reservation.resource.provider } : {}), ...(reservation.resource.model ? { model: reservation.resource.model } : {}) })), ...peerView.running];
    return { graph, unitTraits, resolvedResources, peerUnits: peerView.peerUnits, capacity: { topology: m.execution.execution_mode === 'single' ? 1 : Math.max(1, m.execution.topology?.parallelism ?? 1), global: policy.global, providers: { ...(policy.providers ?? {}) }, models: { ...(policy.models ?? {}) }, running } };
}
export function taskRuntimeUnitDecision(m, worker, model, scheduler, peerView = EMPTY_PROJECT_SCHEDULING_PEER_VIEW) {
    const snapshot = taskRuntimeSchedulingSnapshot(m, scheduler, { workerId: worker.id, model }, peerView);
    return planScheduling(snapshot).units.find(item => item.executionUnitId === unitID(worker));
}
export function taskRuntimeAdmittedModel(m, worker, models, scheduler, peerView = EMPTY_PROJECT_SCHEDULING_PEER_VIEW, resumeTaskId) {
    if (m.identity.status !== 'active' || m.continuation.user_interrupted || m.identity.semantic_assessment.status !== 'assessed' || worker.status === 'cancelled')
        return undefined;
    const state = lifecycle(m), id = unitID(worker);
    return models.find(model => planSchedulerAdmissions(taskRuntimeSchedulingSnapshot(m, scheduler, { workerId: worker.id, model, resumeTaskId }, peerView), state).executionUnitIds.includes(id));
}
export function reserveTaskRuntimeDispatch(m, worker, model, scheduler, at = Date.now(), peerView = EMPTY_PROJECT_SCHEDULING_PEER_VIEW, resumeTaskId) {
    const state = lifecycle(m), snapshot = taskRuntimeSchedulingSnapshot(m, scheduler, { workerId: worker.id, model, resumeTaskId }, peerView), attempt = executionAttemptIdentity({ executionUnitId: unitID(worker), workerId: worker.id, ordinal: (worker.attempt ?? 0) + 1, generation: m.continuation.generation });
    const out = reserveSchedulerUnit(snapshot, state, { executionUnitId: unitID(worker), workerId: worker.id, attempt, at });
    if (out.accepted)
        m.execution.scheduler = out.state;
    return { ...out, attempt, reservation: out.reservation };
}
function workerReservation(m, workerID) { return lifecycle(m).reservations.find(item => item.workerId === workerID); }
export function bindTaskRuntimeHost(m, workerID, hostExecutionId, at = Date.now()) {
    const reservation = workerReservation(m, workerID);
    if (!reservation)
        return { accepted: false, reason: 'reservation-not-found', state: lifecycle(m) };
    const out = reduceSchedulerLifecycle(lifecycle(m), { type: 'HOST_BOUND', reservationId: reservation.reservationId, attempt: reservation.attempt, hostExecutionId, at });
    if (out.accepted)
        m.execution.scheduler = out.state;
    return out;
}
export function beginTaskRuntimeSettlement(m, worker, at = Date.now()) {
    const reservation = workerReservation(m, worker.id);
    if (!reservation)
        return { accepted: false, reason: 'reservation-not-found', state: lifecycle(m) };
    const attempt = executionAttemptIdentity({ executionUnitId: unitID(worker), workerId: worker.id, ordinal: worker.attempt, generation: worker.generation_at_spawn });
    const out = reduceSchedulerLifecycle(lifecycle(m), { type: 'BEGIN_SETTLEMENT', reservationId: reservation.reservationId, attempt, hostExecutionId: worker.session_id, at });
    if (out.accepted)
        m.execution.scheduler = out.state;
    return out;
}
export function releaseTaskRuntimeReservation(m, workerID, kind = 'RELEASE', at = Date.now()) {
    const reservation = workerReservation(m, workerID);
    if (!reservation)
        return { accepted: true, reason: 'reservation-absent', state: lifecycle(m) };
    const out = reduceSchedulerLifecycle(lifecycle(m), { type: kind, reservationId: reservation.reservationId, attempt: reservation.attempt, hostExecutionId: reservation.hostExecutionId, at });
    if (out.accepted)
        m.execution.scheduler = out.state;
    return out;
}
export function reconcileTaskRuntimeRestart(m, worker, outcome, at = Date.now()) {
    const reservation = workerReservation(m, worker.id);
    if (!reservation)
        return { accepted: true, reason: 'reservation-absent', state: lifecycle(m) };
    if (!worker.session_id || reservation.hostExecutionId !== worker.session_id)
        return { accepted: false, reason: 'restart-host-execution-mismatch', state: lifecycle(m), reservation };
    if (outcome === 'TERMINAL' && reservation.phase === 'SETTLING')
        return { accepted: true, reason: 'restart-already-terminal', state: lifecycle(m), reservation };
    if (outcome === 'ACTIVE' && reservation.phase === 'RUNNING')
        return { accepted: true, reason: 'restart-already-active', state: lifecycle(m), reservation };
    if (reservation.phase !== 'RECONCILING')
        return { accepted: false, reason: `restart-reservation-not-reconciling:${reservation.phase}`, state: lifecycle(m), reservation };
    const out = reduceSchedulerLifecycle(lifecycle(m), { type: 'RECONCILE', reservationId: reservation.reservationId, attempt: reservation.attempt, hostExecutionId: worker.session_id, outcome, at });
    if (out.accepted)
        m.execution.scheduler = out.state;
    return out;
}
export function taskRuntimeReservation(m, workerID) { return workerReservation(m, workerID); }
