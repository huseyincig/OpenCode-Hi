import type { MissionState } from '../mission/types.js';
export interface RecoveryPlan {
    level: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    action: 'continue' | 'same-worker-resume' | 'model-escalation' | 'narrow-task' | 'alternate-plan' | 'fresh-worker' | 'user-action';
    prompt: string;
}
/** Bounded reasoning-stagnation recovery with replay prevention on unchanged semantic state. */
export declare function recoveryPlan(m: MissionState): RecoveryPlan;
