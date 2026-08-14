export declare const PROCESS_STATUSES: readonly ["RUNNING", "EXITED", "TIMED_OUT", "TERMINATED", "ORPHANED"];
export type ProcessStatus = typeof PROCESS_STATUSES[number];
export declare const PROCESS_CLEANUP_STATES: readonly ["ACTIVE", "CLEANUP_PENDING", "CLEANED", "QUARANTINED"];
export type ProcessCleanupState = typeof PROCESS_CLEANUP_STATES[number];
export interface ProcessContract {
    process_id: string;
    mission_id: string;
    task_id: string;
    worker_id: string;
    host: string;
    command_identity: string;
    cwd: string;
    pid: number;
    process_group_id?: number;
    status: ProcessStatus;
    started_at: number;
    ended_at?: number;
    timeout_at?: number;
    exit_code?: number;
    termination_reason?: string;
    output_artifact_refs: string[];
    authority_ref: string;
    cleanup_state: ProcessCleanupState;
}
export declare function processCommandIdentity(input: {
    host: string;
    command: string;
    cwd: string;
}): string;
export declare function isProcessContract(value: unknown): value is ProcessContract;
