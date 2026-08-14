import type { HiConfig } from '../../config/schema.js';
import type { MissionState } from '../mission/types.js';
import type { AvailableModel } from '../routing/model-resolver.js';
import { type RuntimeSignalSink } from '../events/event-sink.js';
import type { BackgroundRegistry } from '../background/registry.js';
import type { ConcurrencyScheduler } from '../scheduler/concurrency.js';
import { ChildExecutionCoordinator } from './child-execution-coordinator.js';
export type ChildCallbackDisposition = 'accept' | 'restart-reconcile-pending' | 'stale-mission';
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
    callbackDisposition(m: MissionState, worker: {
        parent_mission_id?: string;
        generation_at_spawn?: number;
        restart_reconcile_pending?: boolean;
    }): ChildCallbackDisposition;
    constructor(scheduler: ConcurrencyScheduler, registry: BackgroundRegistry, projectRoot: string, getConfig: () => HiConfig, getModels: () => AvailableModel[], getHostConfig: () => Record<string, unknown>, events: RuntimeSignalSink | undefined, child: ChildExecutionCoordinator, drainQueueCallback: () => void);
    recoverStagnation(m: MissionState, level: number): Promise<boolean>;
    recoverRuntimeFailure(m: MissionState, workerID: string, error: string): Promise<boolean>;
    fail(m: MissionState, workerID: string, error: string): void;
}
