import type { ProcessExecutor } from '../../runtime/process/executor.js';
import type { WorkspaceExecutor } from '../../runtime/workspace/executor.js';
export declare class V2UnavailableProcessExecutor implements ProcessExecutor {
    health(): Promise<{
        available: boolean;
        detail: string;
    }>;
    spawn(): Promise<any>;
    write(): Promise<void>;
    read(): Promise<any>;
    observe(): Promise<any>;
    wait(): Promise<any>;
    kill(): Promise<any>;
    cleanup(): Promise<any>;
    reconcile(contract: any): Promise<any>;
}
export declare class V2UnavailableWorkspaceExecutor implements WorkspaceExecutor {
    health(): Promise<{
        available: boolean;
        detail: string;
    }>;
    sourceBaseline(): Promise<string>;
    provision(): Promise<any>;
    reintegrate(): Promise<any>;
    reconcile(lease: any): Promise<any>;
    cleanup(): Promise<void>;
}
