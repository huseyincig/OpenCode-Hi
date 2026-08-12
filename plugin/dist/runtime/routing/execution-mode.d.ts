import type { ExecutionMode, MissionState, NormalizedMissionIntent } from '../mission/types.js';
export interface ExecutionModeDecision {
    mode: ExecutionMode;
    reason: string[];
}
export declare function resolveExecutionMode(intent: NormalizedMissionIntent, m?: MissionState): ExecutionModeDecision;
