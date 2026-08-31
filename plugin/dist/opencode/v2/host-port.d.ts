import type { HostPort, HostCapabilityView } from '../../runtime/host/port.js';
import { type HostCapabilityContract } from '../../contracts/host-capability.js';
import type { V2Context, V2RuntimeFacts } from './types.js';
export declare function v2HostCapabilityView(ctx: V2Context): HostCapabilityView;
export declare function createV2HostPort(ctx: V2Context, facts: V2RuntimeFacts): HostPort;
export declare function createV2OwnedCapabilityObserver(contracts: HostCapabilityContract[]): {
    observe: (id: "process-lifecycle" | "workspace-isolation-binding") => Promise<{
        available: boolean;
        detail: string;
    }>;
    setBrowserAvailable: (available: boolean) => void;
};
