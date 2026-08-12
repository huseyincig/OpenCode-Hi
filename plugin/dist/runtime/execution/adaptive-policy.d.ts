import type { MissionState, NormalizedMissionIntent } from '../mission/types.js';
export type ExecutionPath = 'DIRECT' | 'EVIDENCE' | 'PLANNED' | 'ESCALATED';
export type ExecutionDepth = 'minimal' | 'bounded' | 'coordinated' | 'escalated';
export type ContextDepth = 'local' | 'targeted' | 'dependency-aware' | 'broad';
export type IsolationDepth = 'current-workspace' | 'worktree' | 'strong' | 'restricted';
export interface AdaptiveExecutionDecision {
    path: ExecutionPath;
    role: {
        mode: 'single-role' | 'multi-role';
        reason: string;
    };
    skills: {
        max: number;
        defaultZero: true;
        reason: string;
    };
    capability: {
        model: 'host-default' | 'adaptive' | 'stronger-if-needed';
        tools: 'minimum-sufficient';
        reason: string;
    };
    executionDepth: ExecutionDepth;
    contextDepth: ContextDepth;
    isolationDepth: IsolationDepth;
    reasons: string[];
}
export declare function decideAdaptiveExecution(intent: NormalizedMissionIntent, m?: MissionState): AdaptiveExecutionDecision;
