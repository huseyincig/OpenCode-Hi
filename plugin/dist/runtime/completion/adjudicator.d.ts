import type { MissionState } from '../mission/types.js';
export interface CompletionCheck {
    complete: boolean;
    reasons: string[];
    next?: 'VERIFY' | 'RECONCILE' | 'USER_ACTION_REQUIRED' | 'CONTINUE';
}
export declare function adjudicateCompletion(m: MissionState): CompletionCheck;
