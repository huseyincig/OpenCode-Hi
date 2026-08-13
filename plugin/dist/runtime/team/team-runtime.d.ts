import type { MissionState } from '../mission/types.js';
import { TaskRuntime } from '../task/task-runtime.js';
export interface TeamState {
    id: string;
    mission_id: string;
    mission_generation: number;
    objective: string;
    status: 'active' | 'shutdown';
    shutdown_reason?: string;
    members: string[];
    worker_ids: string[];
    member_workers: Record<string, string>;
    created_at: number;
    expires_at: number;
}
export interface TeamLimits {
    maxMembers: number;
    maxWallMs: number;
}
export declare class TeamRuntime {
    #private;
    private tasks;
    private enabled;
    private limits;
    constructor(tasks: TaskRuntime, enabled: () => boolean, limits: () => TeamLimits);
    get(id: string): TeamState | undefined;
    list(missionID: string): TeamState[];
    private active;
    private assertMissionOwner;
    private assertCurrentMission;
    private startMember;
    create(m: MissionState, objective: string, members: string[], memberModels?: Record<string, {
        model?: string;
        variant?: string;
    }>): Promise<TeamState>;
    addMember(m: MissionState, teamID: string, role: string, overrideModel?: string, overrideVariant?: string): Promise<{
        member: string;
        worker_id: string;
    }>;
    removeMember(m: MissionState, teamID: string, role: string): Promise<boolean>;
    adoptSemanticGeneration(m: MissionState): number;
    shutdown(m: MissionState, teamID: string, reason?: string): Promise<boolean>;
    expireMission(m: MissionState, now?: number): Promise<void>;
    reconcileMission(m: MissionState): Promise<void>;
    shutdownMission(m: MissionState): Promise<void>;
}
