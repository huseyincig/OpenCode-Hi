export type HostCapabilityStatus = 'SUPPORTED' | 'DEGRADED' | 'UNSUPPORTED';
export type HostCapabilityVerificationLevel = 'DECLARED' | 'OBSERVED' | 'CONTROLLED_ACCEPTANCE' | 'REAL_HOST_ACCEPTANCE';
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
export interface HostCapabilityContract {
    id: string;
    host_id: 'opencode';
    status: HostCapabilityStatus;
    verification_level: HostCapabilityVerificationLevel;
    native_primitive?: string;
    adapter_entrypoint?: string;
    fallback?: string;
    semantic_loss: string[];
    required_permissions: string[];
    acceptance_ref: string;
    forbidden_fake_behavior: string;
}
export declare function openCodeHostCapabilityContracts(o: OpenCodeCapabilityObservation): HostCapabilityContract[];
export declare function hostCapabilityByID(items: readonly HostCapabilityContract[], id: string): HostCapabilityContract | undefined;
