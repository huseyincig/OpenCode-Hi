import type { MissionStore } from '../runtime/mission/mission-store.js';
import type { BackgroundRegistry } from '../runtime/background/registry.js';
/** Thin boundary around experimental OpenCode hooks. Core mission logic must not depend on hook names. */
export declare class ExperimentalOpenCodeAdapter {
    private store;
    private background;
    constructor(store: MissionStore, background: BackgroundRegistry);
    compacting(): (input: any, output: any) => Promise<void>;
    capabilityReport(): {
        compactionBridge: string;
        businessStateCoupledToHookName: boolean;
    };
}
