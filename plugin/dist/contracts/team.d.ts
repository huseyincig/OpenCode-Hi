export declare const TEAM_CONTRACT_STATUSES: readonly ["active", "shutdown"];
export type TeamContractStatus = typeof TEAM_CONTRACT_STATUSES[number];
export interface TeamContract {
    team_id: string;
    mission_id: string;
    generation: number;
    member_task_refs: string[];
    member_role_refs: string[];
    capacity: number;
    status: TeamContractStatus;
    created_at: number;
    shutdown_at?: number;
}
export declare function isTeamContract(v: unknown): v is TeamContract;
