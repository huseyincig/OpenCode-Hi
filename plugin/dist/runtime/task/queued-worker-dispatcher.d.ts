import type { HiConfig } from '../../config/schema.js';
import type { MissionState, MissionTask, WorkerState } from '../mission/types.js';
import type { AvailableModel } from '../routing/model-resolver.js';
import type { ConcurrencyPolicySource } from '../scheduler/concurrency.js';
import { type ProjectSchedulingPeerView } from '../scheduler/project-peer-view.js';
import type { ChildSessionPort } from '../host/port.js';
import type { RuntimeSignalSink } from '../events/event-sink.js';
import type { RuntimeScopedStores } from '../application/runtime-scoped-stores.js';
import type { LocalPreviewManager } from '../browser/local-preview.js';
import type { ChildWorkspaceBinding } from './child-execution-coordinator.js';
import { ChildExecutionCoordinator } from './child-execution-coordinator.js';
import { BackgroundRegistry } from '../background/registry.js';
import { DependencyOutcomeProjectionError } from '../execution/dependency-outcome-projection.js';
export interface QueuedDispatchTransient {
    relevantContext?: string[];
    forkFromSession?: string;
}
/**
 * Stateless post-admission dispatcher. Durable Task/Worker/ExecutionProfile state is the
 * dispatch recipe; process-local queue entries only schedule when that recipe may run.
 */
export declare class QueuedWorkerDispatcher {
    private readonly childHost;
    private readonly child;
    private readonly registry;
    private readonly scheduler;
    private readonly projectRoot;
    private readonly scopedStores;
    private readonly getConfig;
    private readonly getModels;
    private readonly getHostConfig;
    private readonly workspaceBinding;
    private readonly cleanupWorkspaceForTask;
    private readonly blockDependencyOutcome;
    private readonly events?;
    private readonly previewManager?;
    private readonly getProjectPeerView;
    constructor(childHost: ChildSessionPort, child: ChildExecutionCoordinator, registry: BackgroundRegistry, scheduler: ConcurrencyPolicySource, projectRoot: string, scopedStores: RuntimeScopedStores, getConfig: () => HiConfig, getModels: () => AvailableModel[], getHostConfig: () => Record<string, unknown>, workspaceBinding: (m: MissionState, taskID: string) => ChildWorkspaceBinding | undefined, cleanupWorkspaceForTask: (m: MissionState, taskID: string) => Promise<boolean>, blockDependencyOutcome: (m: MissionState, task: MissionTask, worker: WorkerState, error: DependencyOutcomeProjectionError) => Promise<void>, events?: RuntimeSignalSink | undefined, previewManager?: LocalPreviewManager | undefined, getProjectPeerView?: (m: MissionState) => ProjectSchedulingPeerView);
    run(m: MissionState, task: MissionTask, worker: WorkerState, transient?: QueuedDispatchTransient): Promise<WorkerState>;
}
