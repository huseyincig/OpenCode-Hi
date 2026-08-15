import { isContextReferenceContract } from './context-reference.js';
export const COMPRESSION_POLICY_VERSION = 'hi-context-compression/v1';
const KEYS = new Set(['id', 'source_context_refs', 'source_hashes', 'summary', 'created_at', 'freshness', 'consumer_scope', 'model_identity', 'compression_policy_version']);
function record(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function strings(v) { return Array.isArray(v) && v.length > 0 && v.every(x => typeof x === 'string' && x.length > 0); }
export function isCompressionArtifact(v) {
    if (!record(v) || !Object.keys(v).every(k => KEYS.has(k)) || typeof v.id !== 'string' || !/^a_[a-f0-9]{24}$/.test(v.id) || !strings(v.source_context_refs) || !strings(v.source_hashes) || v.source_context_refs.length !== v.source_hashes.length)
        return false;
    if (typeof v.summary !== 'string' || !v.summary.trim() || typeof v.created_at !== 'number' || !Number.isFinite(v.created_at) || !['FRESH', 'POTENTIALLY_STALE'].includes(String(v.freshness)))
        return false;
    if (typeof v.consumer_scope !== 'string' || !v.consumer_scope.trim() || typeof v.model_identity !== 'string' || !v.model_identity.trim() || typeof v.compression_policy_version !== 'string' || !v.compression_policy_version.trim())
        return false;
    return v.source_hashes.every(x => /^[a-f0-9]{64}$/.test(x));
}
export function buildCompressionArtifact(id, sources, summary, input) {
    if (!sources.length)
        throw new Error('CompressionArtifact requires at least one context source');
    if (sources.some(s => !isContextReferenceContract(s)))
        throw new Error('CompressionArtifact requires valid ContextReference contracts');
    if (sources.some(s => s.protection !== 'COMPRESSIBLE'))
        throw new Error('CompressionArtifact accepts only COMPRESSIBLE context sources');
    if (sources.some(s => s.freshness === 'UNKNOWN'))
        throw new Error('CompressionArtifact rejects UNKNOWN source freshness');
    if (sources.some(s => !s.content_hash || !/^[a-f0-9]{64}$/.test(s.content_hash)))
        throw new Error('CompressionArtifact requires source content hashes');
    const consumerScope = input.consumerScope.trim();
    if (!consumerScope)
        throw new Error('CompressionArtifact requires consumer scope');
    if (sources.some(s => s.consumer_ref !== consumerScope))
        throw new Error('CompressionArtifact sources must be explicitly bound to the exact compression consumer scope');
    const refs = sources.map(s => s.source_ref), hashes = sources.map(s => s.content_hash);
    if (new Set(refs).size !== refs.length)
        throw new Error('CompressionArtifact source refs must be unique');
    const artifact = { id, source_context_refs: refs, source_hashes: hashes, summary: summary.trim(), created_at: input.createdAt ?? Date.now(), freshness: sources.some(s => s.freshness === 'POTENTIALLY_STALE') ? 'POTENTIALLY_STALE' : 'FRESH', consumer_scope: consumerScope, model_identity: input.modelIdentity.trim(), compression_policy_version: (input.policyVersion ?? COMPRESSION_POLICY_VERSION).trim() };
    if (!isCompressionArtifact(artifact))
        throw new Error('Invalid CompressionArtifact contract');
    return artifact;
}
