export type FailureClass = 'code-failure' | 'test-failure' | 'environment-failure' | 'provider-failure' | 'permission-failure' | 'authority-failure' | 'tool-failure' | 'context-insufficiency' | 'model-capability-insufficiency' | 'contract-ambiguity';
export interface MissionBudget {
    maxTurns: number;
    maxModelCalls: number;
    maxToolCalls: number;
    maxDelegations: number;
    maxParallelism: number;
    maxSameFailureRetries: number;
    maxContextChars: number;
    planningBudget: number;
    verificationBudget: number;
    reviewBudget: number;
}
export declare const DEFAULT_MISSION_BUDGET: MissionBudget;
export declare function materiallyDifferentRetry(previous: {
    failure: FailureClass;
    strategy: string;
    evidence?: string;
    tool?: string;
    model?: string;
}, next: {
    failure: FailureClass;
    strategy: string;
    evidence?: string;
    tool?: string;
    model?: string;
}): boolean;
