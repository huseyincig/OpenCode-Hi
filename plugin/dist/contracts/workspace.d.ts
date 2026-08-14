export declare const ISOLATION_STRATEGIES: readonly ["none", "git-worktree"];
export type IsolationStrategy = typeof ISOLATION_STRATEGIES[number];
export interface IsolationDecisionContract {
    required: boolean;
    reason: string;
    strategy: IsolationStrategy;
    scope: string[];
    requested_by: string;
}
export declare const WORKSPACE_LEASE_STATUSES: readonly ["ACTIVE", "RECONCILING", "CLOSED", "ORPHANED"];
export type WorkspaceLeaseStatus = typeof WORKSPACE_LEASE_STATUSES[number];
export declare const WORKSPACE_CLEANUP_STATES: readonly ["ACTIVE", "CLEANUP_PENDING", "CLEANED", "QUARANTINED"];
export type WorkspaceCleanupState = typeof WORKSPACE_CLEANUP_STATES[number];
export interface WorkspaceLeaseContract {
    lease_id: string;
    mission_id: string;
    task_id: string;
    repository_root: string;
    base_ref: string;
    workspace_path: string;
    host_workspace_id?: string;
    branch?: string;
    created_at: number;
    status: WorkspaceLeaseStatus;
    cleanup_state: WorkspaceCleanupState;
    source_baseline: string;
}
export declare function isIsolationDecisionContract(v: unknown): v is IsolationDecisionContract;
export declare function isWorkspaceLeaseContract(v: unknown): v is WorkspaceLeaseContract;
