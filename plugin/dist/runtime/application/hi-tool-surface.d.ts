import { type HiConfig, type ConfigResolutionReport } from '../../config/schema.js';
import { type AvailableModel } from '../routing/model-resolver.js';
import type { MissionStore } from '../mission/mission-store.js';
import type { TaskRuntime } from '../task/task-runtime.js';
import type { ProcessRuntime } from '../process/runtime.js';
import type { WorkspaceRuntime } from '../workspace/runtime.js';
import type { BrowserExecutor } from '../browser/executor.js';
import type { HostCapabilityView, HostNativeSessionPort } from '../host/port.js';
import type { RuntimeScopedStores } from './runtime-scoped-stores.js';
export interface PluginRuntimeState {
    config: HiConfig;
    configResolution?: ConfigResolutionReport;
    hostConfig: Record<string, unknown>;
    openCodeVersion?: string;
}
export declare function createHiToolSurface(input: {
    state: PluginRuntimeState;
    store: MissionStore;
    tasks: TaskRuntime;
    processRuntime: ProcessRuntime;
    workspaceRuntime?: WorkspaceRuntime;
    browserExecutor?: BrowserExecutor;
    projectRoot: string;
    capabilities: HostCapabilityView;
    native: HostNativeSessionPort;
    getModels: () => AvailableModel[];
    scopedStores: RuntimeScopedStores;
    getBrowserBootstrapStatus?: () => {
        available: boolean;
        attempted?: boolean;
        cachePath?: string;
        version?: string;
        executablePath?: string;
        reason?: string;
    } | undefined;
}): {
    toolSurface: Record<string, unknown>;
    reconfigure: () => void;
};
