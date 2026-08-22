import { type EvidenceOutcome, type WorkerEvidenceKind } from './evidence-kinds.js';
import { type ReviewFinding } from './review-finding.js';
export { WORKER_EVIDENCE_KINDS } from './evidence-kinds.js';
export type { EvidenceOutcome, WorkerEvidenceKind } from './evidence-kinds.js';
export type WorkerResultStatus = 'DONE' | 'FIX_REQUIRED' | 'NEEDS_CONTEXT' | 'BLOCKED' | 'FAILED';
/** Worker-produced evidence is a claim/candidate only. It is never canonical verification proof by itself. */
export interface WorkerEvidenceClaim {
    kind: WorkerEvidenceKind;
    summary: string;
    scope?: string[];
    evidence_refs?: string[];
    pass?: boolean;
    outcome?: EvidenceOutcome;
    reason?: string;
}
/** @deprecated Use WorkerEvidenceClaim. Kept as a compatibility alias for existing consumers. */
export type WorkerEvidence = WorkerEvidenceClaim;
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
    evidence: WorkerEvidenceClaim[];
    findings?: ReviewFinding[];
    open_issues: string[];
    needs_context: string[];
    context_gap?: 'scope' | 'iterative' | 'none';
    failure_finding?: 'ci-build' | 'unknown-root-cause' | 'none';
    methodology_observations?: MethodologyObservation[];
}
export declare function isWorkerEvidenceClaimContract(v: unknown): v is WorkerEvidenceClaim;
export declare function isMethodologyObservationContract(v: unknown): v is MethodologyObservation;
export declare function isWorkerResultContract(v: unknown): v is WorkerResult;
export declare function normalizeWorkerResult(raw: unknown): WorkerResult;
