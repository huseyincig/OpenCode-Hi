import type { HiConfig } from '../../config/schema.js';
import type { Category, MissionState, WorkerResult, WorkerState } from '../mission/types.js';
import { type AvailableModel } from '../routing/model-resolver.js';
import { BackgroundRegistry } from '../background/registry.js';
import type { OpenCodeLifecycleEndpoint } from '../../opencode/client-adapter.js';
import { ConcurrencyScheduler } from '../scheduler/concurrency.js';
import type { RuntimeSignalSink } from '../events/event-sink.js';
export interface StartTaskInput {
    objective?: string;
    role?: string;
    category?: Category;
    scope?: string[];
    dependencies?: string[];
    requiredEvidence?: string[];
    obligationIds?: string[];
    model?: string;
    modelVariant?: string;
    relevantContext?: string[];
    contextArtifactIds?: string[];
    constraints?: string[];
    forkFromSession?: string;
}
export declare class TaskRuntime {
    #private;
    private client;
    private registry;
    private scheduler;
    private projectRoot;
    private hiRoot;
    private getConfig;
    private getModels;
    private getHostConfig;
    private events?;
    constructor(client: any, registry: BackgroundRegistry, scheduler: ConcurrencyScheduler, projectRoot: string, hiRoot: string, getConfig: () => HiConfig, getModels: () => AvailableModel[], getHostConfig: () => Record<string, unknown>, events?: RuntimeSignalSink | undefined, lifecycle?: OpenCodeLifecycleEndpoint);
    private sendProviderPrompt;
    private recordModelProjection;
    private abortNativeSession;
    private captureNativeDiff;
    reconcileNativeResult(m: MissionState, workerID: string, result: WorkerResult): Promise<WorkerResult>;
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
    resolveChildCallback(sessionID: string): WorkerState | undefined;
    childCallbackDisposition(m: MissionState, worker: WorkerState): import("./task-recovery-coordinator.js").ChildCallbackDisposition;
    queueDepth(): number;
    private depsReady;
    private failedDeps;
    private canRun;
    private queueTask;
    private drainQueue;
    start(m: MissionState, input?: StartTaskInput): Promise<{
        task_id: string;
        worker_id: string;
        session_id?: string;
        model?: string;
        methodologies: string[];
        selection_reason: string[];
        readiness: 'READY' | 'WAIT';
        preconditions: Array<{
            id: string;
            decision: string;
            reason: string;
        }>;
    }>;
    pauseForSemanticAssessment(m: MissionState): Promise<number>;
    resumeAfterSemanticAssessment(m: MissionState, messageKind: string): Promise<number>;
    reconcileUserConstraint(m: MissionState, text: string): Promise<number>;
    noteNativeWriteSet(m: MissionState, workerID: string, files: string[], source?: string, stateHash?: string): Promise<void>;
    noteNativeStatus(m: MissionState, workerID: string, status: string): void;
    applyResult(m: MissionState, workerID: string, result: WorkerResult): void;
    recoverStagnation(m: MissionState, level: number): Promise<boolean>;
    recoverRuntimeFailure(m: MissionState, workerID: string, error: string): Promise<boolean>;
    fail(m: MissionState, workerID: string, error: string): void;
    peek(m: MissionState, id: string): any;
    list(m: MissionState): any[];
    cancelAll(m: MissionState): Promise<number>;
    cancel(m: MissionState, id: string): Promise<boolean>;
}
