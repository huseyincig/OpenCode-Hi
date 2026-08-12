export type BenchmarkScenarioId = 'simple-local-task' | 'unknown-repository-convention' | 'complex-cross-module-task' | 'failed-verification' | 'long-session' | 'human-gated-task' | 'long-running-process' | 'multi-model-task' | 'multi-agent-task';
export interface BenchmarkObservation {
    modelCalls: number;
    agentCount: number;
    toolCalls: number;
    contextChars: number;
    skills: number;
    verificationActions: number;
    delegations: number;
    retries: number;
    humanInteractions: number;
    productiveActions: number;
    totalActions: number;
    elapsedUnits: number;
}
export interface BenchmarkScenarioResult {
    id: BenchmarkScenarioId;
    kind: 'DETERMINISTIC_POLICY_SIMULATION';
    claimBoundary: string;
    before: BenchmarkObservation;
    after: BenchmarkObservation;
    deltas: {
        executionCost: number;
        wastedComputeRatio: number;
        contextEfficiency: number;
        agentCount: number;
        contextChars: number;
        totalActions: number;
    };
    evidence: string[];
}
export declare function runDeterministicBenchmarks(): BenchmarkScenarioResult[];
