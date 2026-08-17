import type { ProgressDelta } from '../../contracts/orchestration-core.js';
import type { MissionState } from '../mission/types.js';
export interface SemanticProgressSnapshot {
    version: 1;
    state_hash: string;
    evidence_ids: string[];
    invalidated_evidence_ids: string[];
    completed_task_ids: string[];
    completed_dependency_ids: string[];
    closed_obligation_ids: string[];
    changed_files: string[];
    failure_signatures: string[];
    terminal_process_ids: string[];
}
/** Host-neutral semantic state fingerprint. Deliberately excludes prose summaries, timestamps and raw activity counts. */
export declare function semanticProgressSnapshot(m: MissionState): SemanticProgressSnapshot;
export declare function semanticProgressDelta(previous: SemanticProgressSnapshot | undefined, next: SemanticProgressSnapshot): ProgressDelta;
/** Positive progress or new diagnostic information; mere state churn/invalidation is not progress. */
export declare function semanticProgressMade(delta: ProgressDelta): boolean;
export declare function isSemanticProgressSnapshot(v: unknown): v is SemanticProgressSnapshot;
export declare function isProgressDelta(v: unknown): v is ProgressDelta;
