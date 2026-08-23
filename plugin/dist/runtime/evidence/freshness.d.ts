import type { EvidenceItem } from '../mission/types.js';
/**
 * Canonical compatibility freshness projection.
 * Freshness authority lives in current non-invalidated passed Evidence items;
 * the persisted `execution.evidence.fresh` field is only a checked cache/projection.
 */
export declare function hasFreshPassedEvidence(items: readonly EvidenceItem[]): boolean;
