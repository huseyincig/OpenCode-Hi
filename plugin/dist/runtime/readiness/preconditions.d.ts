import type { MissionState } from '../mission/types.js';
export type ReadinessStatus = 'ready' | 'waiting' | 'blocked' | 'not-applicable';
export interface ReadinessItem {
    id: string;
    status: ReadinessStatus;
    reason: string;
}
export declare function evaluatePreconditions(m: MissionState, projectRoot?: string): {
    ready: boolean;
    items: ReadinessItem[];
};
export type TaskPreconditionDecision = 'READY' | 'WAIT' | 'RESOLVE' | 'USER_ACTION_REQUIRED';
export interface TaskPreconditionItem {
    id: string;
    decision: TaskPreconditionDecision;
    reason: string;
}
export interface TaskPreconditionInput {
    role: string;
    implementation: boolean;
    dependencies: {
        unknown: string[];
        failed: string[];
        incomplete: string[];
    };
    modelAvailable: boolean;
    native: {
        childSession: boolean;
        prompt: boolean;
    };
    hostConfig?: Record<string, unknown>;
    methodologyResourceFailures?: string[];
    contractCriticalAmbiguity?: boolean;
    staleExplorationClearance?: boolean;
    authorityRequired?: boolean;
}
export interface TaskPreconditionResult {
    decision: TaskPreconditionDecision;
    items: TaskPreconditionItem[];
}
export declare function evaluateTaskPreconditions(input: TaskPreconditionInput): TaskPreconditionResult;
export declare class TaskPreconditionError extends Error {
    readonly result: TaskPreconditionResult;
    constructor(result: TaskPreconditionResult);
}
