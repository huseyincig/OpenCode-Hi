import type { OpenCodeClient } from './types.js';
import type { WorkspaceLeaseContract } from '../contracts/workspace.js';
import type { WorkspaceExecutor, WorkspaceProvisionRequest, WorkspaceProvisioned, WorkspaceReintegrateRequest, WorkspaceReintegrated, WorkspaceReconcileResult } from '../runtime/workspace/executor.js';
export interface GitWorkspaceInspection {
    head: string;
    common_dir: string;
    worktrees: string[];
}
export type GitWorkspaceInspector = (directory: string) => GitWorkspaceInspection;
export declare function openCodeExperimentalWorkspacesEnabled(env?: Record<string, string | undefined>): boolean;
export declare class OpenCodeWorkspaceAdapter implements WorkspaceExecutor {
    #private;
    readonly client: OpenCodeClient;
    readonly serverUrl: URL;
    readonly directory: string;
    readonly inspector: GitWorkspaceInspector;
    constructor(client: OpenCodeClient, serverUrl: URL, directory: string, inspector?: GitWorkspaceInspector);
    health(): Promise<{
        available: boolean;
        detail: string;
    }>;
    sourceBaseline(repositoryRoot: string): Promise<string>;
    provision(request: WorkspaceProvisionRequest): Promise<WorkspaceProvisioned>;
    reintegrate(request: WorkspaceReintegrateRequest): Promise<WorkspaceReintegrated>;
    reconcile(lease: WorkspaceLeaseContract): Promise<WorkspaceReconcileResult>;
    cleanup(lease: WorkspaceLeaseContract): Promise<void>;
}
