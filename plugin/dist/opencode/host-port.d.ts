import { NativeOpenCodeAdapter } from './native-adapter.js';
export declare function createHostPort(ctx: any): {
    client: any;
    capabilities: import("./capabilities.js").OpenCodeCapabilities;
    native: NativeOpenCodeAdapter;
    log: (level: "debug" | "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) => Promise<void>;
    refreshRuntimeInventory: (reason: string) => Promise<number>;
    getModels: () => import("../contracts/model.js").ModelCapabilityProfile[];
};
