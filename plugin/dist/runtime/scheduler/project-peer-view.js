import { projectMissionToWorkGraph } from '../execution/work-graph-projection.js';
import { isHiReadOnlyChildRole } from '../roles/catalog.js';
export const EMPTY_PROJECT_SCHEDULING_PEER_VIEW = { peerUnits: [], running: [], activeWriters: [] };
function peerUnitID(missionID, executionUnitID) { return `${missionID}::${executionUnitID}`; }
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
    const peerUnits = [], running = [], activeWriters = [];
    for (const mission of byMission.values()) {
        for (const worker of mission.execution.workers)
            if (!isHiReadOnlyChildRole(worker.role) && ['starting', 'busy'].includes(worker.status))
                activeWriters.push({ missionId: mission.identity.mission_id, workerId: worker.id, taskId: worker.task_id, status: worker.status, writeSet: [...(worker.write_set ?? [])] });
        if (mission.identity.mission_id === current.identity.mission_id)
            continue;
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
