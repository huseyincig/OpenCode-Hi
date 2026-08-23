import type { BackgroundRegistry } from '../runtime/background/registry.js';
import { MissionStore } from '../runtime/mission/mission-store.js';
export declare function createSystemTransformHook(store: MissionStore, background?: BackgroundRegistry, projectRoot?: string, workingDirectory?: string, getSettingsOnboarding?: () => {
    pending: boolean;
    modelCount: number;
}): (input: any, output: any) => Promise<void>;
