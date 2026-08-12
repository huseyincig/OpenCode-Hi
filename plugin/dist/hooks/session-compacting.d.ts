import type { BackgroundRegistry } from '../runtime/background/registry.js';
import { MissionStore } from '../runtime/mission/mission-store.js';
export declare function createSessionCompactingHook(store: MissionStore, background?: BackgroundRegistry): (input: any, output: any) => Promise<void>;
