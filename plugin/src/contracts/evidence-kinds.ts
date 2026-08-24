export type EvidenceOutcome = 'pending'|'passed'|'failed'|'environment-issue'
export const WORKER_EVIDENCE_KINDS=['targeted-tests','typecheck','lint','build','changed-surface-sanity','review-evidence','decision-evidence','diagnostic-evidence','measurement-evidence','browser-evidence','visual-evidence','accessibility-evidence','source-provenance-evidence'] as const
export type WorkerEvidenceKind = typeof WORKER_EVIDENCE_KINDS[number]
export const EVIDENCE_OUTCOMES=['pending','passed','failed','environment-issue'] as const

/**
 * `outcome` is the canonical structured verdict when present. `pass` is a legacy
 * scalar compatibility projection only; it may agree with passed/failed or be
 * omitted, but it cannot contradict the richer outcome vocabulary.
 */
export function evidenceVerdictConsistent(pass:boolean|undefined,outcome:EvidenceOutcome|undefined):boolean{
  if(pass===undefined||outcome===undefined)return true
  return(outcome==='passed'&&pass===true)||(outcome==='failed'&&pass===false)
}
export function resolvedEvidenceOutcome(pass:boolean|undefined,outcome:EvidenceOutcome|undefined):EvidenceOutcome|undefined{
  if(outcome!==undefined)return outcome
  return pass===true?'passed':pass===false?'failed':undefined
}
export function evidenceVerdictPassValue(pass:boolean|undefined,outcome:EvidenceOutcome|undefined):boolean|undefined{
  const resolved=resolvedEvidenceOutcome(pass,outcome)
  return resolved==='passed'?true:resolved==='failed'?false:undefined
}
export function evidenceVerdictPassed(pass:boolean|undefined,outcome:EvidenceOutcome|undefined):boolean{return resolvedEvidenceOutcome(pass,outcome)==='passed'}
export function evidenceVerdictFailed(pass:boolean|undefined,outcome:EvidenceOutcome|undefined):boolean{return resolvedEvidenceOutcome(pass,outcome)==='failed'}
