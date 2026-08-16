import type { SchedulingDecision, SchedulingSnapshot } from '../../contracts/orchestration-core.js';
/** Pure scheduling policy: no acquisition, queue mutation, host call, or session execution. */
export declare function planScheduling(snapshot: SchedulingSnapshot): SchedulingDecision;
