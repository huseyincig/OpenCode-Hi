import type { BackgroundRegistry } from '../runtime/background/registry.js';
import { MissionStore } from '../runtime/mission/mission-store.js';
export declare function createToolBeforeHook(store: MissionStore, background?: BackgroundRegistry, projectRoot?: string): (input: any, output: any) => Promise<void>;
