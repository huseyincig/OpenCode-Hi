export type WorkerResultStatus = 'DONE' | 'FIX_REQUIRED' | 'NEEDS_CONTEXT' | 'BLOCKED' | 'FAILED';
export type EvidenceOutcome = 'pending' | 'passed' | 'failed' | 'environment-issue';
export declare const WORKER_EVIDENCE_KINDS: readonly ["targeted-tests", "typecheck", "lint", "build", "changed-surface-sanity", "review-evidence", "decision-evidence", "diagnostic-evidence", "measurement-evidence", "browser-evidence", "visual-evidence", "accessibility-evidence", "source-provenance-evidence"];
export type WorkerEvidenceKind = typeof WORKER_EVIDENCE_KINDS[number];
export interface WorkerEvidence {
    kind: WorkerEvidenceKind;
    summary: string;
    scope?: string[];
    pass?: boolean;
    outcome?: EvidenceOutcome;
    reason?: string;
}
export interface MethodologyObservation {
    key: string;
    procedure: string;
    trigger: string;
    do_not_trigger: string;
    exit_condition: string;
    evidence: WorkerEvidenceKind[];
}
export interface ScopeExpansion {
    file: string;
    reason: string;
    necessary: boolean;
}
export interface WorkerResult {
    status: WorkerResultStatus;
    summary: string;
    changed_files: string[];
    scope_expansions?: ScopeExpansion[];
    evidence: WorkerEvidence[];
    open_issues: string[];
    needs_context: string[];
    context_gap?: 'scope' | 'iterative' | 'none';
    failure_finding?: 'ci-build' | 'unknown-root-cause' | 'none';
    methodology_observations?: MethodologyObservation[];
}
export declare function isWorkerEvidenceContract(v: unknown): v is WorkerEvidence;
export declare function isMethodologyObservationContract(v: unknown): v is MethodologyObservation;
export declare function isWorkerResultContract(v: unknown): v is WorkerResult;
export declare function normalizeWorkerResult(raw: unknown): WorkerResult;
