export type HostCapability = 'child_sessions' | 'async_sessions' | 'model_override' | 'native_permissions' | 'structured_output' | 'mcp' | 'shell' | 'edit' | 'compaction_hook' | 'process_events' | 'workspace_isolation';
export type CapabilityResolution = 'NATIVE' | 'SAFE_EMULATION' | 'DEGRADED' | 'UNSUPPORTED';
export interface CapabilityManifest {
    host: string;
    capabilities: Partial<Record<HostCapability, CapabilityResolution>>;
}
export declare function resolveHostCapability(manifest: CapabilityManifest, capability: HostCapability): CapabilityResolution;
export declare const OPENCODE_REFERENCE_CAPABILITIES: CapabilityManifest;
