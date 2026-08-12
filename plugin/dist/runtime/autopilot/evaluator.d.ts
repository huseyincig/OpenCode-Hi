import type { MissionState } from '../mission/types.js';
export type RuntimeDecision = 'NOTHING' | 'WAIT' | 'CONTINUE' | 'RECONCILE' | 'VERIFY' | 'RECOVER' | 'USER_ACTION_REQUIRED' | 'STOP';
export type IdleReasonCode = 'no-active-mission' | 'user-stop' | 'mission-inactive' | 'continuation-lock' | 'continuation-reentrant' | 'suppressed' | 'waiting-permission' | 'waiting-worker' | 'worker-result-unreconciled' | 'contract-ambiguity-repo-first' | 'precondition-blocked' | 'complete' | 'waiting-user-authority' | 'verification-pending' | 'verification-failed' | 'verification-environment-issue' | 'provider-failure-blocked' | 'permission-failure-blocked' | 'continuation-runtime-retry' | 'continuation-runtime-exhausted' | 'bounded-autonomy-exhausted' | 'stagnation-recovery' | 'open-obligation';
export interface DecisionResult {
    decision: RuntimeDecision;
    reason: string;
    reason_code: IdleReasonCode;
    prompt?: string;
}
export declare function evaluateIdle(m: MissionState | undefined, now?: number): DecisionResult;
export declare function continuationPrompt(m: MissionState, action: string): string;
export declare function shouldCountStagnation(decision: DecisionResult): boolean;
