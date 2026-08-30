import type { MissionTask } from '../mission/types.js';
/**
 * Compatibility projection for older benchmark/test consumers.
 * Canonical mutable-surface policy lives in planner.evaluateSchedulingSurfaceConflicts;
 * this helper must never grow independent scheduling semantics again.
 */
export declare function parallelSafety(existing: MissionTask[], candidate: {
    scope: string[];
    dependencies: string[];
    role?: string;
}): {
    safe: boolean;
    reasons: string[];
};
