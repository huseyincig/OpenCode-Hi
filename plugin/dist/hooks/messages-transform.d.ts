import type { BackgroundRegistry } from '../runtime/background/registry.js';
import type { MissionStore } from '../runtime/mission/mission-store.js';
export declare function createMessagesTransformHook(store: MissionStore, background: BackgroundRegistry): (input: any, output: any) => Promise<void>;
