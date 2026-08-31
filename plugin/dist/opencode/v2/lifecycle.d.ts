import type { createHiRuntime } from '../../runtime/application/plugin-runtime.js';
import type { V2Context, V2RuntimeFacts } from './types.js';
type Runtime = Awaited<ReturnType<typeof createHiRuntime>>;
export declare function adaptV2Permissions(value: unknown): Array<Record<string, string>>;
export declare function v2EventStatus(event: any): 'idle' | 'busy' | 'retry' | 'unknown' | undefined;
export declare function normalizeV2Event(event: any): import("../../runtime/host/port.js").HostEvent;
export declare function registerV2Lifecycle(ctx: V2Context, runtime: Runtime, facts: V2RuntimeFacts): Promise<() => Promise<void>>;
export {};
