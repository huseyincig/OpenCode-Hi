export type EvidenceOutcome = 'pending' | 'passed' | 'failed' | 'environment-issue';
export declare const WORKER_EVIDENCE_KINDS: readonly ["targeted-tests", "typecheck", "lint", "build", "changed-surface-sanity", "review-evidence", "decision-evidence", "diagnostic-evidence", "measurement-evidence", "browser-evidence", "visual-evidence", "accessibility-evidence", "source-provenance-evidence"];
export type WorkerEvidenceKind = typeof WORKER_EVIDENCE_KINDS[number];
export declare const EVIDENCE_OUTCOMES: readonly ["pending", "passed", "failed", "environment-issue"];
