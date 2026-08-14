import { type ContextReferenceContract, type ContextFreshness } from './context-reference.js';
export declare const COMPRESSION_POLICY_VERSION = "hi-context-compression/v1";
export interface CompressionArtifact {
    id: string;
    source_context_refs: string[];
    source_hashes: string[];
    summary: string;
    created_at: number;
    freshness: Extract<ContextFreshness, 'FRESH' | 'POTENTIALLY_STALE'>;
    consumer_scope: string;
    model_identity: string;
    compression_policy_version: string;
}
export declare function isCompressionArtifact(v: unknown): v is CompressionArtifact;
export declare function buildCompressionArtifact(id: string, sources: ContextReferenceContract[], summary: string, input: {
    consumerScope: string;
    modelIdentity: string;
    policyVersion?: string;
    createdAt?: number;
}): CompressionArtifact;
