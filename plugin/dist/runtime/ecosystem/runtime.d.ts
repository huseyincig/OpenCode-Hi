import type { HostCapabilityContract } from '../../contracts/host-capability.js';
import type { OperationalToolProvisioningReceipt } from '../../contracts/operational-tool.js';
export interface EcosystemCapabilityView {
    id: string;
    status: 'SUPPORTED' | 'DEGRADED' | 'UNSUPPORTED';
    verification_level: string;
    native_primitive?: string;
    adapter_entrypoint?: string;
    fallback?: string;
    semantic_loss: string[];
    runtime_health_required: boolean;
}
export interface EcosystemOperationalToolView {
    capability: string;
    implementation_id: string;
    status: string;
    scope: string;
    discovery_source: string;
    smoke_ok: boolean;
    observed_at: number;
}
export interface EcosystemIntegrationView {
    native_host: {
        source: 'HostCapabilityContract/opencode-live';
        capabilities: EcosystemCapabilityView[];
    };
    mcp: {
        source: 'opencode-native-config-projection';
        configured: string[];
        selected: string[];
        disabled_patterns: string[];
    };
    operational_tools: {
        source: 'OperationalToolProvisioner-receipts';
        receipts: EcosystemOperationalToolView[];
    };
    degradation: {
        unsupported: string[];
        degraded: string[];
    };
    boundaries: {
        semantic_owner: 'Mission/Task/Worker contracts';
        authority_owner: 'AuthorityContract/ExternalAction runtime';
        evidence_owner: 'EvidenceRuntime/VerificationEnvelope';
        context_owner: 'ContextArtifactStore';
        storage_owner: 'declared storage ownership only';
        native_owner: 'OpenCode host/provider/session/runtime';
        secrets_owner: 'host/provider';
        transport_ack: 'observation-only-until-owning-contract-reconciliation';
    };
    persistence_owner: 'none-derived-view';
    claim_boundary: 'derived-integration-composition-only';
}
/**
 * Bounded ecosystem/integration composition view.
 *
 * It reads existing native-capability/config/provisioning owners and strips
 * executable paths, authority payloads and raw host configuration values. It
 * never becomes a plugin registry, capability inventory owner, approval store,
 * Evidence source, credential store or completion signal.
 */
export declare function ecosystemIntegrationView(input: {
    hostCapabilities: readonly HostCapabilityContract[];
    hostConfig: Record<string, unknown>;
    selectedMcpServers?: readonly string[];
    operationalToolReceipts?: readonly (OperationalToolProvisioningReceipt | undefined)[];
}): EcosystemIntegrationView;
