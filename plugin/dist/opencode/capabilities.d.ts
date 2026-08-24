import type { OpenCodeClient } from './types.js';
import { type HostCapabilityContract, type OpenCodeOwnedCapabilityObservation } from '../contracts/host-capability.js';
export interface OpenCodeCapabilities {
    childSessions: boolean;
    asyncPrompt: boolean;
    syncPrompt: boolean;
    abort: boolean;
    providerInventory: boolean;
    appLog: boolean;
    sessionStatus: boolean;
    childSessionList: boolean;
    sessionTodo: boolean;
    sessionDiff: boolean;
    sessionFork: boolean;
    sessionSummarize: boolean;
    sessionRevert: boolean;
    sessionUnrevert: boolean;
    workerRuntime: boolean;
    degraded: string[];
    contracts: HostCapabilityContract[];
}
export declare function detectOpenCodeCapabilities(client: OpenCodeClient, owned?: OpenCodeOwnedCapabilityObservation): OpenCodeCapabilities;
export interface OwnedCapabilityHealthProbe {
    health: () => Promise<{
        available: boolean;
        detail?: string;
    }>;
}
export declare function createOwnedCapabilityObserver(client: OpenCodeClient, contracts: HostCapabilityContract[], processProbe: OwnedCapabilityHealthProbe, workspaceProbe: OwnedCapabilityHealthProbe): {
    observe: (id: "process-lifecycle" | "workspace-isolation-binding") => Promise<{
        available: boolean;
        detail?: string;
    }>;
    setBrowserAvailable: (available: boolean) => void;
};
