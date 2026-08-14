import type { OpenCodeClient } from './types.js';
import type { WorkspaceLeaseContract } from '../contracts/workspace.js';
import type { WorkspaceExecutor, WorkspaceProvisionRequest, WorkspaceProvisioned, WorkspaceReconcileResult } from '../runtime/workspace/executor.js';
export interface GitWorkspaceInspection {
    head: string;
    common_dir: string;
    worktrees: string[];
}
export type GitWorkspaceInspector = (directory: string) => GitWorkspaceInspection;
export declare class OpenCodeWorkspaceAdapter implements WorkspaceExecutor {
    #private;
    readonly client: OpenCodeClient;
    readonly serverUrl: URL;
    readonly directory: string;
    readonly inspector: GitWorkspaceInspector;
    constructor(client: OpenCodeClient, serverUrl: URL, directory: string, inspector?: GitWorkspaceInspector);
    sourceBaseline(repositoryRoot: string): Promise<string>;
    provision(request: WorkspaceProvisionRequest): Promise<WorkspaceProvisioned>;
    reconcile(lease: WorkspaceLeaseContract): Promise<WorkspaceReconcileResult>;
    cleanup(lease: WorkspaceLeaseContract): Promise<void>;
}
