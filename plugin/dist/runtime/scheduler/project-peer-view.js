import { projectMissionToWorkGraph } from '../execution/work-graph-projection.js';
import { isHiReadOnlyChildRole, primaryRoleCanDirectImplementation } from '../roles/catalog.js';
import { evaluateSchedulingSurfaceConflicts } from './planner.js';
export const EMPTY_PROJECT_SCHEDULING_PEER_VIEW = { peerUnits: [], running: [], activeWriters: [] };
function peerUnitID(missionID, executionUnitID) { return `${missionID}::${executionUnitID}`; }
function directParentOwnsImplementation(mission) { return mission.identity.status === 'active' && !mission.continuation.user_interrupted && mission.identity.semantic_assessment.status === 'assessed' && mission.execution.execution_mode !== 'parallel' && ['DIRECT', 'EVIDENCE'].includes(mission.execution.adaptive_execution?.path ?? '') && primaryRoleCanDirectImplementation(mission.execution.primary_mode) && mission.execution.obligations.some(item => item.kind === 'implementation' && item.status === 'open'); }
function directParentClaimClock(mission) {
    const writeTasks = mission.execution.tasks.filter(task => !isHiReadOnlyChildRole(task.role)), delegatedActive = writeTasks.some(task => !['completed', 'failed', 'cancelled'].includes(task.status));
    let at = mission.identity.created_at;
    for (const task of writeTasks)
        if (['completed', 'failed', 'cancelled'].includes(task.status))
            at = Math.max(at, task.updated_at);
    for (const worker of mission.execution.workers.filter(worker => !isHiReadOnlyChildRole(worker.role)))
        if (['completed', 'failed', 'cancelled'].includes(worker.status))
            at = Math.max(at, worker.completed_at ?? worker.updated_at ?? worker.started_at ?? mission.identity.created_at);
    return { at, delegatedActive };
}
function directParentPeer(mission, scope, suppressWhileDelegated = false) {
    if (!directParentOwnsImplementation(mission))
        return undefined;
    const clock = directParentClaimClock(mission);
    if (suppressWhileDelegated && clock.delegatedActive)
        return undefined;
    return { executionUnitId: peerUnitID(mission.identity.mission_id, 'parent-direct'), missionId: mission.identity.mission_id, workNodeId: 'parent-direct', status: 'created', scope: [...(scope?.length ? scope : (mission.identity.intent.likelyTargets ?? []))], writeSet: [...mission.vcs.changed_files], readOnly: false, createdAt: clock.at };
}
function localConflictUnits(mission) {
    const graph = projectMissionToWorkGraph(mission, Date.now());
    return graph.executionUnits.flatMap(unit => { const node = graph.nodes.find(item => item.id === unit.workNodeId); if (!node)
        return []; return [{ executionUnitId: unit.id, missionId: mission.identity.mission_id, workNodeId: unit.workNodeId, status: node.status, scope: [...unit.scope], writeSet: [...unit.writeSet], readOnly: isHiReadOnlyChildRole(unit.role), createdAt: node.createdAt }]; });
}
/** Project-runtime parent write admission derived only from canonical Mission/Task/Worker state. */
export function projectDirectMutationDecision(current, projectMissions, exactSurface = []) {
    const candidatePeer = directParentPeer(current, exactSurface);
    if (!candidatePeer)
        return { applicable: false, safe: true, surface: [], blockingUnitIds: [], reasons: [] };
    const candidate = { ...candidatePeer }, view = projectSchedulingPeerView(current, projectMissions), peers = [...localConflictUnits(current), ...view.peerUnits.map(peer => ({ ...peer }))];
    const assessed = evaluateSchedulingSurfaceConflicts(candidate, peers);
    return { applicable: true, safe: assessed.reasons.length === 0, surface: [...candidate.scope, ...candidate.writeSet].filter((value, index, all) => value && all.indexOf(value) === index), blockingUnitIds: assessed.blocking, reasons: assessed.reasons };
}
/**
 * Side-effect-free project-level projection over canonical Mission state. It does not allocate,
 * reserve, lock, or persist anything; each Mission remains the owner of its own Task/Worker and
 * SchedulerLifecycle reservation state.
 */
export function projectSchedulingPeerView(current, projectMissions) {
    const byMission = new Map();
    for (const mission of [current, ...projectMissions])
        if (!byMission.has(mission.identity.mission_id))
            byMission.set(mission.identity.mission_id, mission);
    const peerUnits = [], running = [], activeWriters = [], currentOrder = directParentClaimClock(current);
    for (const mission of byMission.values()) {
        for (const worker of mission.execution.workers)
            if (!isHiReadOnlyChildRole(worker.role) && ['starting', 'busy'].includes(worker.status))
                activeWriters.push({ missionId: mission.identity.mission_id, workerId: worker.id, taskId: worker.task_id, status: worker.status, writeSet: [...(worker.write_set ?? [])] });
        if (mission.identity.mission_id === current.identity.mission_id)
            continue;
        const direct = directParentPeer(mission, undefined, true), directPrecedes = Boolean(direct && (direct.createdAt < currentOrder.at || (direct.createdAt === currentOrder.at && mission.identity.mission_id < current.identity.mission_id)));
        if (direct && directPrecedes)
            peerUnits.push(direct);
        const graph = projectMissionToWorkGraph(mission, Date.now()), workers = new Map(mission.execution.workers.map(worker => [worker.task_id, worker])), reservations = mission.execution.scheduler?.reservations ?? [], reserved = new Set(reservations.map(item => item.executionUnitId));
        for (const reservation of reservations)
            running.push({ executionUnitId: peerUnitID(mission.identity.mission_id, reservation.executionUnitId), missionId: mission.identity.mission_id, ...(reservation.resource.provider ? { provider: reservation.resource.provider } : {}), ...(reservation.resource.model ? { model: reservation.resource.model } : {}) });
        for (const unit of graph.executionUnits) {
            const node = graph.nodes.find(item => item.id === unit.workNodeId), worker = workers.get(unit.workNodeId);
            if (!node)
                continue;
            const active = reserved.has(unit.id) || Boolean(worker && ['starting', 'busy'].includes(worker.status)), status = active ? 'running' : node.status;
            if (!active && (mission.identity.status !== 'active' || !['created', 'queued'].includes(status)))
                continue;
            peerUnits.push({ executionUnitId: peerUnitID(mission.identity.mission_id, unit.id), missionId: mission.identity.mission_id, workNodeId: unit.workNodeId, status, scope: [...unit.scope], writeSet: [...unit.writeSet], readOnly: isHiReadOnlyChildRole(unit.role), createdAt: node.createdAt });
        }
    }
    return { peerUnits, running, activeWriters };
}
