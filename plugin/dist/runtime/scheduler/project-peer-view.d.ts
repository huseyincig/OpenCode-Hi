import type { SchedulingConflictPeer, SchedulingRunningAllocation } from '../../contracts/orchestration-core.js';
import type { MissionState } from '../mission/types.js';
export interface ProjectActiveWriterPeer {
    missionId: string;
    workerId: string;
    taskId: string;
    status: string;
    writeSet: string[];
}
export interface ProjectSchedulingPeerView {
    peerUnits: SchedulingConflictPeer[];
    running: SchedulingRunningAllocation[];
    activeWriters: ProjectActiveWriterPeer[];
}
export declare const EMPTY_PROJECT_SCHEDULING_PEER_VIEW: ProjectSchedulingPeerView;
/**
 * Side-effect-free project-level projection over canonical Mission state. It does not allocate,
 * reserve, lock, or persist anything; each Mission remains the owner of its own Task/Worker and
 * SchedulerLifecycle reservation state.
 */
export declare function projectSchedulingPeerView(current: MissionState, projectMissions: readonly MissionState[]): ProjectSchedulingPeerView;
