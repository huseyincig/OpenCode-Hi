import type { HiConfig } from '../../config/schema.js';
import type { MissionState } from '../mission/types.js';
import type { AvailableModel } from '../routing/model-resolver.js';
import { type RuntimeSignalSink } from '../events/event-sink.js';
import type { BackgroundRegistry } from '../background/registry.js';
import type { ConcurrencyPolicySource } from '../scheduler/concurrency.js';
import { ChildExecutionCoordinator, type ChildWorkspaceBinding } from './child-execution-coordinator.js';
export type ChildCallbackDisposition = 'accept' | 'stale-mission';
export type HostTerminalRecoveryDisposition = 'RECOVERED' | 'QUARANTINED' | 'NOT_RECOVERED';
export declare class TaskRecoveryCoordinator {
    private readonly scheduler;
    private readonly registry;
    private readonly projectRoot;
    private readonly getConfig;
    private readonly getModels;
    private readonly getHostConfig;
    private readonly events;
    private readonly child;
    private readonly drainQueueCallback;
    private readonly workspaceBinding?;
    private readonly cleanupBrowser?;
    callbackDisposition(m: MissionState, worker: {
        parent_mission_id?: string;
        generation_at_spawn?: number;
    }): ChildCallbackDisposition;
    constructor(scheduler: ConcurrencyPolicySource, registry: BackgroundRegistry, projectRoot: string, getConfig: () => HiConfig, getModels: () => AvailableModel[], getHostConfig: () => Record<string, unknown>, events: RuntimeSignalSink | undefined, child: ChildExecutionCoordinator, drainQueueCallback: () => void, workspaceBinding?: ((m: MissionState, taskID: string) => ChildWorkspaceBinding | undefined) | undefined, cleanupBrowser?: ((m: MissionState, taskID: string, workerID?: string) => Promise<boolean>) | undefined);
    recoverStalledAwaitWorker(m: MissionState): Promise<{
        disposition: 'NOOP' | 'RECOVERED' | 'QUARANTINED' | 'BLOCKED';
        reason: string;
        worker_id?: string;
        task_id?: string;
        from_model?: string;
        to_model?: string;
    }>;
    recoverStagnation(m: MissionState, level: number, action?: 'same-worker-resume' | 'model-escalation'): Promise<boolean>;
    recoverHostTerminalFailure(m: MissionState, workerID: string, error: unknown): Promise<HostTerminalRecoveryDisposition>;
    fail(m: MissionState, workerID: string, error: string): void;
}
