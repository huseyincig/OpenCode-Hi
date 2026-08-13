export type HostCapability='child_sessions'|'async_sessions'|'model_override'|'native_permissions'|'structured_output'|'mcp'|'shell'|'edit'|'compaction_hook'|'process_events'|'workspace_isolation'
export type CapabilityResolution='NATIVE'|'SAFE_EMULATION'|'DEGRADED'|'UNSUPPORTED'
export interface CapabilityManifest{host:string;capabilities:Partial<Record<HostCapability,CapabilityResolution>>}
export function resolveHostCapability(manifest:CapabilityManifest,capability:HostCapability):CapabilityResolution{return manifest.capabilities[capability]??'UNSUPPORTED'}
export const OPENCODE_REFERENCE_CAPABILITIES:CapabilityManifest={host:'opencode',capabilities:{child_sessions:'NATIVE',async_sessions:'NATIVE',model_override:'NATIVE',native_permissions:'NATIVE',structured_output:'NATIVE',mcp:'NATIVE',shell:'NATIVE',edit:'NATIVE',compaction_hook:'NATIVE',process_events:'DEGRADED',workspace_isolation:'UNSUPPORTED'}}
