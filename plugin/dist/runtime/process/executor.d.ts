import type { ProcessContract } from '../../contracts/process.js';
import type { ExternalActionContract } from '../../contracts/external-action.js';
export type ProcessPermissionDecision = 'allow' | 'ask' | 'deny';
export declare class ProcessSpawnPermissionError extends Error {
    readonly decision: 'ASK' | 'DENY';
    readonly reason: string;
    constructor(decision: 'ASK' | 'DENY', reason: string);
}
export interface ProcessNativePermissionGrant {
    permission: 'bash' | 'external_directory';
    pattern: string;
}
export interface ProcessSpawnRequest {
    mission_id: string;
    task_id: string;
    worker_id: string;
    role: string;
    command: string;
    args?: string[];
    cwd: string;
    env?: Record<string, string>;
    title?: string;
    timeout_ms?: number;
    service_origins?: string[];
    authority_ref: string;
    external_action?: ExternalActionContract;
    native_permission_grants?: ProcessNativePermissionGrant[];
}
export interface ProcessHandle {
    contract: ProcessContract;
    host_process_id: string;
}
export interface ProcessOutputWindow {
    cursor?: number;
    max_chars?: number;
}
export interface ProcessOutput {
    text: string;
    start_cursor: number;
    end_cursor: number;
    available_start_cursor: number;
    available_end_cursor: number;
    truncated: boolean;
    status: ProcessContract['status'];
}
export interface ProcessExit {
    contract: ProcessContract;
}
export interface ProcessReconcileResult {
    disposition: 'ADOPTED' | 'TERMINAL' | 'ORPHANED';
    contract: ProcessContract;
}
export interface ProcessExecutor {
    spawn(request: ProcessSpawnRequest): Promise<ProcessHandle>;
    write(processId: string, input: string): Promise<void>;
    read(processId: string, window?: ProcessOutputWindow): Promise<ProcessOutput>;
    observe(processId: string): Promise<ProcessContract>;
    wait(processId: string): Promise<ProcessExit>;
    kill(processId: string, signal?: 'SIGTERM' | 'SIGINT'): Promise<ProcessExit>;
    cleanup(processId: string): Promise<void>;
    reconcile(contract: ProcessContract): Promise<ProcessReconcileResult>;
}
