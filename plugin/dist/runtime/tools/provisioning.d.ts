import { type OperationalToolAuthority, type OperationalToolDefinition, type OperationalToolDiscoverySource, type OperationalToolProvisioningReceipt, type OperationalToolResolutionScope, type OperationalToolSmokeReceipt } from '../../contracts/operational-tool.js';
export interface OperationalToolDiscovery {
    executable_path: string;
    source: Exclude<OperationalToolDiscoverySource, 'provisioned'>;
    scope: OperationalToolResolutionScope;
    version?: string;
}
export interface OperationalToolProvisioned {
    executable_path: string;
    scope: 'project-local' | 'ephemeral';
    version?: string;
}
export interface OperationalToolContext {
    project_root: string;
    tool_root: string;
    implementation_root: string;
}
export interface OperationalToolAdapter {
    definition: OperationalToolDefinition;
    discover: (context: OperationalToolContext) => Promise<OperationalToolDiscovery | undefined> | OperationalToolDiscovery | undefined;
    provision?: (context: OperationalToolContext) => Promise<OperationalToolProvisioned>;
    smoke: (executablePath: string, context: OperationalToolContext) => Promise<Omit<OperationalToolSmokeReceipt, 'checked_at'>>;
    cleanup?: (provisioned: OperationalToolProvisioned, context: OperationalToolContext) => Promise<void> | void;
}
export interface OperationalToolEnsureInput {
    authority?: OperationalToolAuthority;
}
export declare function discoverOperationalToolOnPath(executable: string, options?: {
    env?: Record<string, string | undefined>;
    platform?: string;
    exists?: (path: string) => boolean;
    pathJoin?: (left: string, right: string) => string;
    pathDelimiter?: string;
}): string | undefined;
export declare class OperationalToolProvisioner {
    #private;
    readonly projectRoot: string;
    readonly toolRoot: string;
    constructor(projectRoot: string, adapters?: readonly OperationalToolAdapter[]);
    register(adapter: OperationalToolAdapter): void;
    last(capability: string): OperationalToolProvisioningReceipt | undefined;
    ensure(capability: string, input?: OperationalToolEnsureInput): Promise<OperationalToolProvisioningReceipt>;
}
