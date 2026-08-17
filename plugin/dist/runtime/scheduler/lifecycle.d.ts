import type { ExecutionAttemptIdentity, SchedulerLifecycleEvent, SchedulerLifecycleResult, SchedulerLifecycleState, SchedulingSnapshot } from '../../contracts/orchestration-core.js';
/** Pure reservation lifecycle. Host execution and persistence side effects live outside this reducer. */
export declare function reduceSchedulerLifecycle(input: SchedulerLifecycleState, event: SchedulerLifecycleEvent): SchedulerLifecycleResult;
export interface SchedulerAdmissionPlan {
    ok: boolean;
    reasons: string[];
    executionUnitIds: string[];
}
/**
 * Pure fairness-aware admission selection. Readiness remains graph-derived; lifecycle state
 * contributes only active reservations so pre-dispatch claims consume capacity.
 */
export declare function planSchedulerAdmissions(snapshot: SchedulingSnapshot, state: SchedulerLifecycleState, limit?: number): SchedulerAdmissionPlan;
export declare function reserveSchedulerUnit(snapshot: SchedulingSnapshot, state: SchedulerLifecycleState, input: {
    executionUnitId: string;
    workerId: string;
    attempt: ExecutionAttemptIdentity;
    at: number;
}): SchedulerLifecycleResult;
export { createSchedulerLifecycleState, schedulerReservationId } from '../../contracts/orchestration-core.js';
