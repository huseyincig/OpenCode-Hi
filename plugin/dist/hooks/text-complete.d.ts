import type { BackgroundRegistry } from '../runtime/background/registry.js';
import { MissionStore } from '../runtime/mission/mission-store.js';
/**
 * OpenCode awaits experimental.text.complete before publishing the completed
 * text part. Keep parent prose non-terminal until Hi's canonical completion
 * owner says the mission may stop. Child text is owned by WorkerResult parsing
 * and user-action-required text must remain visible.
 */
export declare function createTextCompleteHook(store: MissionStore, background?: BackgroundRegistry, projectRoot?: string): (input: any, output: any) => Promise<void>;
