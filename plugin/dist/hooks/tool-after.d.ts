import type { BackgroundRegistry } from '../runtime/background/registry.js';
import type { RuntimeSignalSink } from '../runtime/events/event-sink.js';
import { MissionStore } from '../runtime/mission/mission-store.js';
import { type AuthorityExecutionOutcome } from '../runtime/safety/authority.js';
export declare function authorityOutcome(output: any, text: string): AuthorityExecutionOutcome;
export declare function createToolAfterHook(store: MissionStore, background?: BackgroundRegistry, events?: RuntimeSignalSink, projectRoot?: string, workingDirectory?: string): (input: any, output: any) => Promise<void>;
