import { type EvidenceOutcome, type WorkerEvidenceKind } from './evidence-kinds.js';
import { type ReviewFinding } from './review-finding.js';
export { WORKER_EVIDENCE_KINDS } from './evidence-kinds.js';
export type { EvidenceOutcome, WorkerEvidenceKind } from './evidence-kinds.js';
export type WorkerResultStatus = 'DONE' | 'FIX_REQUIRED' | 'NEEDS_CONTEXT' | 'BLOCKED' | 'FAILED';
export interface WorkerEvidence {
    kind: WorkerEvidenceKind;
    summary: string;
    scope?: string[];
    evidence_refs?: string[];
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
    findings?: ReviewFinding[];
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
