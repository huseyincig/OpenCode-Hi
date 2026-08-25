export declare const OPERATIONAL_TOOL_RECEIPT_SCHEMA: 1;
export type OperationalToolProvisionScope = 'project-local' | 'ephemeral' | 'none';
export type OperationalToolResolutionScope = 'existing' | 'project-local' | 'ephemeral';
export type OperationalToolDiscoverySource = 'explicit' | 'path' | 'host' | 'project-local-cache' | 'provisioned';
export type OperationalToolResolutionStatus = 'existing' | 'cached' | 'provisioned' | 'unavailable';
export type OperationalToolAuthoritySource = 'task-requirement' | 'native-permission' | 'explicit-user';
export interface OperationalToolDefinition {
    capability: string;
    implementation_id: string;
    dependency_class: 'operational-tool';
    version?: string;
    provision_scope: OperationalToolProvisionScope;
    smoke: string;
}
export interface OperationalToolAuthority {
    source: OperationalToolAuthoritySource;
    ref?: string;
}
export interface OperationalToolSmokeReceipt {
    ok: boolean;
    checked_at: number;
    detail?: string;
    version?: string;
}
export interface OperationalToolProvisioningReceipt {
    schema: typeof OPERATIONAL_TOOL_RECEIPT_SCHEMA;
    capability: string;
    implementation_id: string;
    dependency_class: 'operational-tool';
    status: OperationalToolResolutionStatus;
    scope: OperationalToolResolutionScope;
    discovery_source: OperationalToolDiscoverySource;
    executable_path?: string;
    requested_version?: string;
    resolved_version?: string;
    project_tool_root: string;
    authority?: OperationalToolAuthority;
    smoke: OperationalToolSmokeReceipt;
    receipt_path: string;
    observed_at: number;
}
export declare function isOperationalToolDefinition(v: unknown): v is OperationalToolDefinition;
export declare function assertOperationalToolDefinition(v: unknown): asserts v is OperationalToolDefinition;
