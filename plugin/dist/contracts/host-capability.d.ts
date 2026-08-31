export type HostCapabilityStatus = 'SUPPORTED' | 'DEGRADED' | 'UNSUPPORTED';
export type HostCapabilityVerificationLevel = 'DECLARED' | 'OBSERVED' | 'CONTROLLED_ACCEPTANCE' | 'REAL_HOST_ACCEPTANCE';
export type HostCapabilityDiscoverySource = 'RUNTIME_TRUTH' | 'EXPLICIT_HOST_CAPABILITY' | 'SAFE_FEATURE_PROBE' | 'VERSION_METADATA';
export interface OpenCodeCapabilityObservation {
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
}
export interface OpenCodeOwnedCapabilityObservation {
    processLifecycle?: boolean;
    workspaceIsolation?: boolean;
    browserExecution?: boolean;
}
export interface HostCapabilityContract {
    id: string;
    host_id: 'opencode';
    status: HostCapabilityStatus;
    verification_level: HostCapabilityVerificationLevel;
    discovery_source?: HostCapabilityDiscoverySource;
    native_primitive?: string;
    adapter_entrypoint?: string;
    fallback?: string;
    semantic_loss: string[];
    required_permissions: string[];
    runtime_health_required?: boolean;
    acceptance_ref: string;
    forbidden_fake_behavior: string;
}
export declare function openCodeHostCapabilityContracts(o: OpenCodeCapabilityObservation, owned?: OpenCodeOwnedCapabilityObservation): HostCapabilityContract[];
export interface HostCapabilityCandidate {
    contract: HostCapabilityContract;
    source: HostCapabilityDiscoverySource;
}
/**
 * Resolve duplicate observations for the same semantic host capability without
 * using host generation/version as product authority. Higher-quality runtime
 * evidence wins deterministically; version metadata is bounded last-resort
 * evidence only. This is a projection, not a capability truth store.
 */
export declare function negotiateHostCapabilityContracts(candidates: readonly HostCapabilityCandidate[]): HostCapabilityContract[];
export declare function runtimeTruthCapabilities(contracts: readonly HostCapabilityContract[]): HostCapabilityContract[];
export declare function hostCapabilityByID(items: readonly HostCapabilityContract[], id: string): HostCapabilityContract | undefined;
