import type { MissionState, MissionTask, WorkerResult, WorkerState } from '../mission/types.js';
export type ExplorationClearanceReason = 'not-applicable' | 'result-not-done' | 'context-gap-not-explicitly-resolved' | 'open-context-remains' | 'open-issue-remains' | 'source-provenance-claim-missing' | 'source-provenance-scope-unbounded' | 'source-read-receipt-missing' | 'source-provenance-outside-task-scope' | 'source-state-unavailable' | 'decision-claim-missing' | 'decision-claim-scope-unbound' | 'admitted';
export interface ExplorationClearanceAssessment {
    applicable: boolean;
    admitted: boolean;
    reason: ExplorationClearanceReason;
    ambiguity: 'none' | 'resolvable' | 'contract-critical';
    source_scope: string[];
    source_state_hash?: string;
    decision_scope: string[];
}
export interface ExplorationClearanceFreshness {
    required: boolean;
    current: boolean;
    ambiguity?: 'resolvable' | 'contract-critical';
    evidence_id?: string;
    source_scope: string[];
    source_state_hash?: string;
    reason: 'never-required' | 'current' | 'invalidated' | 'source-state-drift' | 'malformed-source';
}
export declare function explorationClearanceEvidenceSource(ambiguity: 'resolvable' | 'contract-critical', taskID: string): string;
/** Freshness fence for a previously admitted exploration clearance. */
export declare function explorationClearanceFreshness(projectRoot: string, m: MissionState): ExplorationClearanceFreshness;
/**
 * Repository exploration may change semantic ambiguity, but it is not verification proof.
 * Clearance requires explicit structured sufficiency plus runtime-bound current source bytes.
 * Contract-critical ambiguity additionally requires a scoped decision claim; that claim remains
 * WorkerResult provenance and is never promoted to canonical Evidence by this mechanism.
 */
export declare function assessExplorationClearance(projectRoot: string, m: MissionState, task: MissionTask, worker: WorkerState, result: WorkerResult): ExplorationClearanceAssessment;
