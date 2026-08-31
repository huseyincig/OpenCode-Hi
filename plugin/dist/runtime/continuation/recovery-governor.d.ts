import type { MissionState } from '../mission/types.js';
import type { RecoveryPlan } from './recovery.js';
export type RecoveryAttemptOutcome = 'started' | 'completed' | 'failed';
export interface RecoveryStrategyContext {
    task_id?: string;
    worker_id?: string;
    model?: string;
    failure_signature?: string;
}
export interface RecoveryStrategyRecord extends RecoveryStrategyContext {
    fingerprint: string;
    level: number;
    action: RecoveryPlan['action'];
    progress_signature: string;
    generation: number;
    attempted_at: number;
    outcome: RecoveryAttemptOutcome;
}
export interface RecoveryModelHazard {
    open: boolean;
    same_model_exhausted: boolean;
    cross_model_exhausted: boolean;
    reason: string;
    task_id?: string;
    worker_id?: string;
    model?: string;
    progress_signature: string;
    failure_signature?: string;
    attempts: number;
    recovery_candidates: string[];
}
/** Recovery identity deliberately ignores activity-only churn such as worker status/attempt counters. */
export declare function recoverySemanticSignature(m: MissionState): string;
export declare function recoveryModelHazard(m: MissionState): RecoveryModelHazard;
export declare function recoveryStrategyFingerprint(m: MissionState, plan: Pick<RecoveryPlan, 'level' | 'action'>): string;
export declare function ambiguousConsequentialEffect(m: MissionState): string | undefined;
export declare function recoveryStrategyEligibility(m: MissionState, plan: Pick<RecoveryPlan, 'level' | 'action'>): {
    allowed: boolean;
    reason: string;
    fingerprint: string;
    progress_signature: string;
};
export declare function recordRecoveryStrategy(m: MissionState, plan: Pick<RecoveryPlan, 'level' | 'action'>, outcome?: RecoveryAttemptOutcome, at?: number, context?: RecoveryStrategyContext): RecoveryStrategyRecord;
export declare function isRecoveryStrategyRecord(v: unknown): v is RecoveryStrategyRecord;
