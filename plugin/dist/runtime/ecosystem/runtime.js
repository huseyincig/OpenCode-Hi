import { resolveMcpServerExposure } from '../routing/execution-profile.js';
/**
 * Bounded ecosystem/integration composition view.
 *
 * It reads existing native-capability/config/provisioning owners and strips
 * executable paths, authority payloads and raw host configuration values. It
 * never becomes a plugin registry, capability inventory owner, approval store,
 * Evidence source, credential store or completion signal.
 */
export function ecosystemIntegrationView(input) {
    const mcp = resolveMcpServerExposure(input.hostConfig, [...(input.selectedMcpServers ?? [])]);
    const capabilities = input.hostCapabilities.map(item => ({
        id: item.id, status: item.status, verification_level: item.verification_level,
        ...(item.native_primitive ? { native_primitive: item.native_primitive } : {}),
        ...(item.adapter_entrypoint ? { adapter_entrypoint: item.adapter_entrypoint } : {}),
        ...(item.fallback ? { fallback: item.fallback } : {}),
        semantic_loss: [...item.semantic_loss], runtime_health_required: item.runtime_health_required === true,
    })).sort((a, b) => a.id.localeCompare(b.id));
    const receipts = (input.operationalToolReceipts ?? []).filter((item) => Boolean(item)).map(item => ({
        capability: item.capability, implementation_id: item.implementation_id, status: item.status, scope: item.scope,
        discovery_source: item.discovery_source, smoke_ok: item.smoke.ok === true, observed_at: item.observed_at,
    })).sort((a, b) => `${a.capability}/${a.implementation_id}`.localeCompare(`${b.capability}/${b.implementation_id}`));
    return {
        native_host: { source: 'HostCapabilityContract/opencode-live', capabilities },
        mcp: { source: 'opencode-native-config-projection', configured: [...mcp.configured], selected: [...mcp.selected], disabled_patterns: [...mcp.disabledPatterns] },
        operational_tools: { source: 'OperationalToolProvisioner-receipts', receipts },
        degradation: { unsupported: capabilities.filter(x => x.status === 'UNSUPPORTED').map(x => x.id), degraded: capabilities.filter(x => x.status === 'DEGRADED').map(x => x.id) },
        boundaries: { semantic_owner: 'Mission/Task/Worker contracts', authority_owner: 'AuthorityContract/ExternalAction runtime', evidence_owner: 'EvidenceRuntime/VerificationEnvelope', context_owner: 'ContextArtifactStore', storage_owner: 'declared storage ownership only', native_owner: 'OpenCode host/provider/session/runtime', secrets_owner: 'host/provider', transport_ack: 'observation-only-until-owning-contract-reconciliation' },
        persistence_owner: 'none-derived-view', claim_boundary: 'derived-integration-composition-only',
    };
}
