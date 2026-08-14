import type { HiConfig, ConfigResolutionReport } from '../../config/schema.js';
import type { AvailableModel } from '../routing/model-resolver.js';
import type { MissionStore } from '../mission/mission-store.js';
import type { TaskRuntime } from '../task/task-runtime.js';
import type { TeamRuntime } from '../team/team-runtime.js';
import type { NativeOpenCodeAdapter } from '../../opencode/native-adapter.js';
import type { detectOpenCodeCapabilities } from '../../opencode/capabilities.js';
export interface PluginRuntimeState {
    config: HiConfig;
    configResolution?: ConfigResolutionReport;
    hostConfig: Record<string, unknown>;
    openCodeVersion?: string;
}
type Capabilities = ReturnType<typeof detectOpenCodeCapabilities>;
export declare function createHiToolSurface(input: {
    state: PluginRuntimeState;
    store: MissionStore;
    tasks: TaskRuntime;
    teams: TeamRuntime;
    projectRoot: string;
    capabilities: Capabilities;
    native: NativeOpenCodeAdapter;
    getModels: () => AvailableModel[];
}): {
    toolSurface: Record<string, unknown>;
    reconfigure: () => void;
};
export {};
