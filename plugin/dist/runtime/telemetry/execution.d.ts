export interface ExecutionTelemetry {
    taskClass: string;
    risk: string;
    executionPath: string;
    roles: string[];
    skills: string[];
    models: string[];
    tools: string[];
    topology: string;
    contextChars: number;
    modelCalls: number;
    toolCalls: number;
    delegations: number;
    retries: number;
    verificationActions: number;
    failureClasses: string[];
    escalationReasons: string[];
    humanInteractions: number;
    materialHumanDecisions: number;
    elapsedMs: number;
    completed: boolean;
    productiveActions: number;
    totalActions: number;
    decisionRelevantContextChars: number;
}
export declare function deriveEfficiencyMetrics(t: ExecutionTelemetry): {
    executionCost: number;
    wastedComputeRatio: number;
    humanAttentionEfficiency: number;
    contextEfficiency: number;
};
