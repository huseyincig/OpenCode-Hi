import type { MissionState } from '../mission/types.js';
export interface RecoveryPlan {
    level: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    action: 'continue' | 'same-worker-resume' | 'model-escalation' | 'narrow-task' | 'alternate-plan' | 'fresh-worker' | 'user-action';
    prompt: string;
}
export interface TaskRecoveryDirective {
    level: 1 | 2 | 3;
    action: 'same-worker-resume' | 'model-escalation';
}
/** Project one canonical recovery decision onto the only task-local recovery executor.
 * Parent-owned recovery actions intentionally return undefined and continue through the parent session. */
export declare function taskRecoveryDirective(reasonCode: string, reason: string): TaskRecoveryDirective | undefined;
/** Bounded reasoning-stagnation recovery with replay prevention on unchanged semantic state. */
export declare function recoveryPlan(m: MissionState): RecoveryPlan;
