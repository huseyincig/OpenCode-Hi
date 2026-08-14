export type EvidenceOutcome = 'pending'|'passed'|'failed'|'environment-issue'
export const WORKER_EVIDENCE_KINDS=['targeted-tests','typecheck','lint','build','changed-surface-sanity','review-evidence','decision-evidence','diagnostic-evidence','measurement-evidence','browser-evidence','visual-evidence','accessibility-evidence','source-provenance-evidence'] as const
export type WorkerEvidenceKind = typeof WORKER_EVIDENCE_KINDS[number]
export const EVIDENCE_OUTCOMES=['pending','passed','failed','environment-issue'] as const
