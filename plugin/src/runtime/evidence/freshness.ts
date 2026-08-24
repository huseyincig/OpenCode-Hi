import type { EvidenceItem } from '../mission/types.js'
import { evidenceVerdictPassed } from '../../contracts/evidence-kinds.js'

/**
 * Canonical compatibility freshness projection.
 * Freshness authority lives in current non-invalidated passed Evidence items;
 * the persisted `execution.evidence.fresh` field is only a checked cache/projection.
 */
export function hasFreshPassedEvidence(items:readonly EvidenceItem[]):boolean{
  return items.some(item=>!item.invalidated_at&&evidenceVerdictPassed(item.pass,item.outcome))
}
