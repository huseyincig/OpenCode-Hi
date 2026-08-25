import type { HiConfig, ConfigResolutionReport } from '../config/schema.js';
import { MissionStore } from '../runtime/mission/mission-store.js';
import type { AvailableModel } from '../runtime/routing/model-resolver.js';
import type { HostCapabilityView } from '../runtime/host/port.js';
import type { OperationalToolProvisioningReceipt } from '../contracts/operational-tool.js';
export interface DoctorCheck {
    id: string;
    status: 'pass' | 'warn' | 'fail';
    machine_status?: 'pass' | 'info' | 'action-required' | 'not-applicable';
    detail: string;
}
export interface DoctorRuntimeInfo {
    models?: AvailableModel[];
    resolution?: ConfigResolutionReport;
    capabilities?: HostCapabilityView;
    hostConfig?: Record<string, unknown>;
    openCodeVersion?: string;
    runtimeHostResources?: ReadonlySet<string>;
    browserBootstrap?: {
        available: boolean;
        attempted?: boolean;
        cachePath?: string;
        version?: string;
        executablePath?: string;
        reason?: string;
    };
    browserToolReceipt?: OperationalToolProvisioningReceipt;
}
export declare function runDoctor(config: HiConfig, store: MissionStore, directory?: string, info?: DoctorRuntimeInfo): DoctorCheck[];
export declare function formatDoctor(c: DoctorCheck[]): string;
