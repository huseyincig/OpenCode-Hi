import type { MissionState, WorkerState } from '../mission/types.js';
import type { BackgroundRegistry } from '../background/registry.js';
import type { ChildSessionPort } from '../host/port.js';
declare function normFile(value: string): string;
export declare function diffDelta(before: Record<string, string> | undefined, after: Record<string, string>): string[];
export { normFile };
export interface ChildWorkspaceBinding {
    workspaceID: string;
    directory: string;
}
export declare class ChildExecutionCoordinator {
    private readonly host;
    private readonly registry?;
    constructor(host: ChildSessionPort, registry?: BackgroundRegistry | undefined);
    resolveCallbackWorker(sessionID: string): WorkerState | undefined;
    create(parentSessionID: string, title: string, role: string, model?: string, variant?: string, workspace?: ChildWorkspaceBinding): Promise<{
        id?: string;
        workspaceID?: string;
        directory?: string;
    }>;
    createForTask(parentSessionID: string, title: string, role: string, model?: string, variant?: string, forkFromSession?: string, workspace?: ChildWorkspaceBinding): Promise<import("../host/port.js").ChildSessionCreateResult>;
    sendProviderPrompt(sessionID: string, text: string, role?: string, model?: string, variant?: string, tools?: Record<string, boolean>, messageID?: string): Promise<unknown>;
    recordModelProjection(worker: WorkerState, model?: string, variant?: string): void;
    abortNativeSession(m: MissionState, sessionID: string, reason: string, workerID?: string, taskID?: string): Promise<boolean>;
    captureNativeDiff(worker: WorkerState, phase: 'baseline' | 'final'): Promise<Record<string, string> | undefined>;
    noteEffectiveModel(m: MissionState, workerID: string, observed?: {
        model?: string;
        variant?: string;
        source?: string;
    }): {
        ok: boolean;
        expected?: string;
        observed?: string;
        reason: string;
    };
}
