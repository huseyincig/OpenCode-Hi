import type { MissionState } from '../mission/types.js';
import { TaskRuntime } from '../task/task-runtime.js';
export interface TeamMessage {
    id: string;
    at: number;
    from: string;
    to: string;
    text: string;
    dedupe_key?: string;
    delivered_to: string[];
    processed_by: string[];
    reservations: Record<string, {
        reserved_at: number;
        expires_at: number;
    }>;
}
export interface TeamBoardItem {
    id: string;
    title: string;
    owner?: string;
    status: 'open' | 'in-progress' | 'done' | 'blocked';
    evidence?: string[];
    updated_at: number;
}
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
    messages: TeamMessage[];
    board: TeamBoardItem[];
    created_at: number;
    expires_at: number;
    turn_count: number;
}
export interface TeamLimits {
    maxMembers: number;
    maxMessages: number;
    maxWallMs: number;
    maxTurns: number;
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
    message(m: MissionState, teamID: string, from: string, to: string, text: string, dedupeKey?: string): TeamMessage;
    inbox(m: MissionState, teamID: string, member: string, since?: number, limit?: number, replay?: boolean): TeamMessage[];
    messageAck(m: MissionState, teamID: string, member: string, messageID: string, processed?: boolean): boolean;
    boardUpsert(m: MissionState, teamID: string, input: {
        id?: string;
        title: string;
        owner?: string;
        status?: TeamBoardItem['status'];
        evidence?: string[];
    }): TeamBoardItem;
    shutdown(m: MissionState, teamID: string, reason?: string): Promise<boolean>;
    expireMission(m: MissionState, now?: number): Promise<void>;
    reconcileMission(m: MissionState): Promise<void>;
    shutdownMission(m: MissionState): Promise<void>;
}
