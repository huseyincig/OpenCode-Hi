import type { MissionState, MissionTask } from '../mission/types.js';
export interface DependencyOutcomeProjection {
    task_id: string;
    worker_id: string;
    attempt_id: string;
    run_id: string;
    generation: number;
    result_digest: string;
    result_status: 'DONE';
    summary: string;
    changed_files: string[];
    source_state_hash?: string;
}
export declare class DependencyOutcomeProjectionError extends Error {
    constructor(message: string);
}
/**
 * Project only direct completed dependency outcomes. This is execution context,
 * never canonical Evidence: worker evidence claims/findings are intentionally
 * excluded so dependency dataflow cannot certify verification or review.
 */
export declare function projectDirectDependencyOutcomes(m: MissionState, task: MissionTask): DependencyOutcomeProjection[];
/** Render valid bounded JSON without ever truncating through an object. */
export declare function renderDirectDependencyOutcomeContext(items: DependencyOutcomeProjection[], maxChars?: number): string | undefined;
