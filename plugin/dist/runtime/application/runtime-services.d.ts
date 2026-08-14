import type { HiConfig } from '../../config/schema.js';
import type { AvailableModel } from '../routing/model-resolver.js';
import type { RuntimeSignalSink } from '../events/event-sink.js';
import { MissionStore } from '../mission/mission-store.js';
import { BackgroundRegistry } from '../background/registry.js';
import { RuntimePersistence } from '../state/persistence.js';
import { ConcurrencyScheduler } from '../scheduler/concurrency.js';
import { TaskRuntime } from '../task/task-runtime.js';
import { TeamRuntime } from '../team/team-runtime.js';
import { ExperimentalOpenCodeAdapter } from '../../opencode/experimental-adapter.js';
export declare function createRuntimeServices(input: {
    ctx: any;
    projectRoot: string;
    packageRoot: string;
    getConfig: () => HiConfig;
    getModels: () => AvailableModel[];
    getHostConfig: () => Record<string, unknown>;
}): {
    store: MissionStore;
    background: BackgroundRegistry;
    persistence: RuntimePersistence;
    scheduler: ConcurrencyScheduler;
    eventSink: RuntimeSignalSink;
    tasks: TaskRuntime;
    experimental: ExperimentalOpenCodeAdapter;
    teams: TeamRuntime;
};
