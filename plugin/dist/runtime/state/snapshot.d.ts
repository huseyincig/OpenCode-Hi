import type { MissionState, WorkerState } from '../mission/types.js';
/**
 * Compaction survival state is intentionally priority-preserving rather than a
 * transcript summary. Every section is independently bounded so a large task
 * or obligation list cannot push blockers / next-safe-action / STOP conditions
 * out of the host compaction context.
 */
export declare function compactMissionContext(m: MissionState, worker?: WorkerState): string;
