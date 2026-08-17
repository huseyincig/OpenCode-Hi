import type { MissionState } from '../mission/types.js';
import type { RecoveryPlan } from './recovery.js';
export type RecoveryAttemptOutcome = 'started' | 'completed' | 'failed';
export interface RecoveryStrategyRecord {
    fingerprint: string;
    level: number;
    action: RecoveryPlan['action'];
    progress_signature: string;
    generation: number;
    attempted_at: number;
    outcome: RecoveryAttemptOutcome;
}
export declare function recoveryStrategyFingerprint(m: MissionState, plan: Pick<RecoveryPlan, 'level' | 'action'>): string;
export declare function ambiguousConsequentialEffect(m: MissionState): string | undefined;
export declare function recoveryStrategyEligibility(m: MissionState, plan: Pick<RecoveryPlan, 'level' | 'action'>): {
    allowed: boolean;
    reason: string;
    fingerprint: string;
    progress_signature: string;
};
export declare function recordRecoveryStrategy(m: MissionState, plan: Pick<RecoveryPlan, 'level' | 'action'>, outcome?: RecoveryAttemptOutcome, at?: number): RecoveryStrategyRecord;
export declare function isRecoveryStrategyRecord(v: unknown): v is RecoveryStrategyRecord;
