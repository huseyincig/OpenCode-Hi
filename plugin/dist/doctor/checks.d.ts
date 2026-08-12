import type { HhcConfig, ConfigResolutionReport } from '../config/schema.js';
import { MissionStore } from '../runtime/mission/mission-store.js';
import type { AvailableModel } from '../runtime/routing/model-resolver.js';
import type { OpenCodeCapabilities } from '../opencode/capabilities.js';
export interface DoctorCheck {
    id: string;
    status: 'pass' | 'warn' | 'fail';
    machine_status?: 'pass' | 'info' | 'action-required' | 'not-applicable';
    detail: string;
}
export interface DoctorRuntimeInfo {
    models?: AvailableModel[];
    resolution?: ConfigResolutionReport;
    capabilities?: OpenCodeCapabilities;
    hostConfig?: Record<string, unknown>;
    openCodeVersion?: string;
}
export declare function runDoctor(config: HhcConfig, store: MissionStore, directory?: string, info?: DoctorRuntimeInfo): DoctorCheck[];
export declare function formatDoctor(c: DoctorCheck[]): string;
