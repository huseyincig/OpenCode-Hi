import type { WorkerResultStatus } from './worker-result.js';
export declare const TASK_OUTCOME_MEMORY_STATUS: readonly ["DONE", "FIX_REQUIRED", "NEEDS_CONTEXT", "BLOCKED", "FAILED"];
export declare const TASK_OUTCOME_MEMORY_FAILURE_FINDINGS: readonly ["ci-build", "unknown-root-cause"];
export interface TaskOutcomeMemoryRecord {
    schema: 1;
    type: 'hi-task-outcome-memory';
    fingerprint: string;
    source_state_hash: string;
    scope: string[];
    outcome: WorkerResultStatus;
    attempt: number;
    generation: number;
    result_digest: string;
    issue_classes: string[];
    failure_finding?: 'ci-build' | 'unknown-root-cause';
    recorded_at: number;
}
export declare function isTaskOutcomeMemoryRecord(v: unknown): v is TaskOutcomeMemoryRecord;
