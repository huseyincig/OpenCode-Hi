import { type HostCapabilityContract } from '../contracts/host-capability.js';
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
export declare function detectOpenCodeCapabilities(client: any): OpenCodeCapabilities;
