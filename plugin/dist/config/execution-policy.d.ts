import type { ExecutionPolicyMode } from './schema.js';
import type { NormalizedMissionIntent } from '../runtime/mission/types.js';
export type ExecutionProfileName = 'minimal' | 'balanced' | 'thorough';
export declare function executionProfileFor(mode: ExecutionPolicyMode, intent: NormalizedMissionIntent): ExecutionProfileName;
export declare function automaticContinuationEnabled(mode: ExecutionPolicyMode): boolean;
export declare function adaptiveIdleEvaluatorEnabled(mode: ExecutionPolicyMode): boolean;
