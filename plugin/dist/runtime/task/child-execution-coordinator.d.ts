import type { OpenCodeClient } from '../../opencode/types.js';
import type { MissionState, WorkerState } from '../mission/types.js';
import type { BackgroundRegistry } from '../background/registry.js';
import { type OpenCodeLifecycleEndpoint } from '../../opencode/client-adapter.js';
declare function normFile(value: string): string;
export declare function diffDelta(before: Record<string, string> | undefined, after: Record<string, string>): string[];
export { normFile };
export declare class ChildExecutionCoordinator {
    private readonly client;
    private readonly lifecycle;
    private readonly registry?;
    constructor(client: OpenCodeClient, lifecycle?: OpenCodeLifecycleEndpoint, registry?: BackgroundRegistry | undefined);
    resolveCallbackWorker(sessionID: string): WorkerState | undefined;
    create(parentSessionID: string, title: string, role: string, model?: string, variant?: string): Promise<{
        id?: string;
    }>;
    createForTask(parentSessionID: string, title: string, role: string, model?: string, variant?: string, forkFromSession?: string): Promise<{
        child: {
            id?: string;
        };
        fork: {
            requested: boolean;
            nativeAvailable: boolean;
            used: false;
            reason?: string;
        };
    }>;
    sendProviderPrompt(sessionID: string, text: string, role?: string, model?: string, variant?: string, tools?: Record<string, boolean>): Promise<unknown>;
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
