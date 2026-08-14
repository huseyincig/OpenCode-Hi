import type { MissionState, WorkerResult, WorkerState } from '../mission/types.js';
import { type RuntimeSignalSink } from '../events/event-sink.js';
import type { BackgroundRegistry } from '../background/registry.js';
import type { ConcurrencyScheduler } from '../scheduler/concurrency.js';
import type { ProjectMethodologyLearningStore } from '../project-intelligence/methodology-learning.js';
import { ChildExecutionCoordinator } from './child-execution-coordinator.js';
type QueueTask = (m: MissionState, worker: WorkerState, run: () => Promise<WorkerState>) => void;
export declare class TaskResultReconciler {
    private readonly scheduler;
    private readonly registry;
    private readonly projectRoot;
    private readonly events;
    private readonly methodologyLearning;
    private readonly child;
    private readonly queueTaskCallback;
    private readonly drainQueueCallback;
    constructor(scheduler: ConcurrencyScheduler, registry: BackgroundRegistry, projectRoot: string, events: RuntimeSignalSink | undefined, methodologyLearning: ProjectMethodologyLearningStore, child: ChildExecutionCoordinator, queueTaskCallback: QueueTask, drainQueueCallback: () => void);
    private queueTask;
    private drainQueue;
    reconcileNativeResult(m: MissionState, workerID: string, result: WorkerResult): Promise<WorkerResult>;
    noteNativeWriteSet(m: MissionState, workerID: string, files: string[], source?: string, stateHash?: string): Promise<void>;
    noteNativeStatus(m: MissionState, workerID: string, status: string): void;
    applyResult(m: MissionState, workerID: string, result: WorkerResult): void;
}
export {};
