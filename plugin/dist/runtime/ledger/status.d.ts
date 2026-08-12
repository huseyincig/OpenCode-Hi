import type { MissionState } from '../mission/types.js';
export interface UserMissionStatus {
    status: string;
    active_workers: number;
    open_obligations: number;
    evidence: 'fresh' | 'stale';
    blockers: number;
    next_action: 'wait' | 'verify' | 'recover' | 'continue' | 'user-action' | 'complete';
}
export declare function userMissionStatus(m: MissionState): UserMissionStatus;
export declare function formatUserMissionStatus(m: MissionState): string;
