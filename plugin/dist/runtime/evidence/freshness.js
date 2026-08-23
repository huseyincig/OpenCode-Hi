/**
 * Canonical compatibility freshness projection.
 * Freshness authority lives in current non-invalidated passed Evidence items;
 * the persisted `execution.evidence.fresh` field is only a checked cache/projection.
 */
export function hasFreshPassedEvidence(items) {
    return items.some(item => !item.invalidated_at && (item.outcome === 'passed' || item.pass === true));
}
