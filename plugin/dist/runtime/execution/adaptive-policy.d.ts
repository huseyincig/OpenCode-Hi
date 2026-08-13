import type { MissionState, NormalizedMissionIntent } from '../mission/types.js';
export type ExecutionPath = 'DIRECT' | 'EVIDENCE' | 'PLANNED' | 'ESCALATED';
export interface AdaptiveExecutionDecision {
    path: ExecutionPath;
    reasons: string[];
}
export declare function decideAdaptiveExecution(intent: NormalizedMissionIntent, m?: MissionState): AdaptiveExecutionDecision;
