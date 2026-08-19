import type { SchedulingDecision, SchedulingSnapshot } from '../../contracts/orchestration-core.js';
/**
 * Prepare graph-derived scheduling decisions once. The returned planner is pure and
 * call-scoped: only capacity.running may vary between invocations. No runtime state is cached.
 */
export declare function createSchedulingPlanner(snapshot: SchedulingSnapshot): (capacity?: SchedulingSnapshot['capacity']) => SchedulingDecision;
/** Pure scheduling policy: no acquisition, queue mutation, host call, or session execution. */
export declare function planScheduling(snapshot: SchedulingSnapshot): SchedulingDecision;
