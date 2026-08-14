import type { OpenCodePluginContext, OpenCodeClient } from './types.js';
import type { AvailableModel } from '../runtime/routing/model-resolver.js';
import { detectOpenCodeCapabilities } from './capabilities.js';
import { NativeOpenCodeAdapter } from './native-adapter.js';
export interface HostPort {
    client: OpenCodeClient;
    capabilities: ReturnType<typeof detectOpenCodeCapabilities>;
    native: NativeOpenCodeAdapter;
    log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, extra?: Record<string, unknown>) => Promise<void>;
    refreshRuntimeInventory: (reason: string) => Promise<number>;
    getModels: () => AvailableModel[];
}
export declare function createHostPort(ctx: OpenCodePluginContext): HostPort;
