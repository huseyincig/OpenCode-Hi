import type { SchedulingDecision, SchedulingReasonCode, SchedulingResourceBinding, SchedulingSnapshot, WorkNode } from '../../contracts/orchestration-core.js';
export interface SchedulingConflictSurface {
    executionUnitId: string;
    missionId: string;
    workNodeId: string;
    status: WorkNode['status'];
    scope: string[];
    writeSet: string[];
    readOnly: boolean;
    admissionEligible?: boolean;
    createdAt: number;
}
/** One pure mutable-surface policy shared by child scheduling and parent direct-write admission. */
export declare function evaluateSchedulingSurfaceConflicts(candidate: SchedulingConflictSurface, peers: readonly SchedulingConflictSurface[], dependencies?: readonly string[]): {
    blocking: string[];
    reasons: Array<{
        code: SchedulingReasonCode;
        detail?: string;
    }>;
};
export declare function evaluateSchedulingResourceCapacity(capacity: SchedulingSnapshot['capacity'], unitID: string, binding: SchedulingResourceBinding | undefined): {
    ok: boolean;
    reason?: {
        code: SchedulingReasonCode;
        detail?: string;
    };
};
/**
 * Prepare graph-derived scheduling decisions once. The returned planner is pure and
 * call-scoped: only capacity.running may vary between invocations. No runtime state is cached.
 */
export declare function createSchedulingPlanner(snapshot: SchedulingSnapshot): (capacity?: SchedulingSnapshot['capacity']) => SchedulingDecision;
/** Pure scheduling policy: no acquisition, queue mutation, host call, or session execution. */
export declare function planScheduling(snapshot: SchedulingSnapshot): SchedulingDecision;
