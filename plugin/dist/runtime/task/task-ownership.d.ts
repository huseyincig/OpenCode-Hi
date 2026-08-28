import type { MissionState, MissionTask, TaskStatus } from '../mission/types.js';
/** Canonical obligation ownership is separate from the historical child attempt/result. */
export declare function taskOwnedObligationsClosed(m: MissionState, task: MissionTask): boolean;
/** A settled unresolved attempt can lose control authority only after every owned obligation closed. */
export declare function taskHasSatisfiedSettledOwnership(m: MissionState, task: MissionTask): boolean;
/** Scheduler/control projection only; raw durable Task/WorkerResult history is intentionally unchanged. */
export declare function taskControlStatus(m: MissionState, task: MissionTask): TaskStatus;
export declare function taskPendingForControl(m: MissionState, task: MissionTask): boolean;
export declare function taskResultRequiresReconciliation(m: MissionState, task: MissionTask): boolean;
/**
 * Retire only mission-level artifacts that belonged to a settled task whose canonical ownership
 * has already been satisfied elsewhere. The raw WorkerResult remains immutable historical truth.
 */
export declare function reconcileSatisfiedTaskArtifacts(m: MissionState, reason?: string): string[];
