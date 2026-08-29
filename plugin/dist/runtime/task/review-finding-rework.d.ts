import type { ReviewFinding } from '../../contracts/review-finding.js';
import type { MissionState, MissionTask, WorkerState } from '../mission/types.js';
export declare function reviewFindingReworkObligationId(findingID: string): string;
/**
 * Reviewer/verifier findings never grant mutation authority to the read-only task that found them.
 * A bounded, current-attempt, evidence-backed blocking introduced/worsened finding instead opens a distinct
 * implementation obligation. This preserves the failed review attempt as history while returning
 * corrective repository ownership to a canonical writer before fresh re-verification.
 */
export declare function materializeReviewFindingRework(m: MissionState, task: MissionTask, worker: WorkerState, findings: ReviewFinding[]): string[];
export declare function taskHasDelegatedReviewFindingRework(m: MissionState, task: MissionTask): boolean;
