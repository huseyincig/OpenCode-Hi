import type { BackgroundRegistry } from '../runtime/background/registry.js';
import { MissionStore } from '../runtime/mission/mission-store.js';
export declare function createSystemTransformHook(store: MissionStore, background?: BackgroundRegistry, getPrimaryMode?: () => 'auto' | 'working-manager' | 'manager'): (input: any, output: any) => Promise<void>;
