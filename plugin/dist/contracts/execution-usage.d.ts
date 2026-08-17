export type UsageTokenSource = 'opencode-step-finish' | 'opencode-assistant-message';
export type UsageCoverage = 'assistant-step-total' | 'assistant-message-reported';
export type UsageConfidence = 'exact';
export type MonetaryUsageSource = 'opencode-calculated' | 'provider-billed';
export type MonetaryUsageConfidence = 'derived' | 'exact';
export interface ExecutionTokenUsage {
    input: number;
    output: number;
    reasoning: number;
    cache_read: number;
    cache_write: number;
}
export interface HostUsageObservation {
    message_id?: string;
    model_identity?: string;
    observed_at?: number;
    token_source: UsageTokenSource;
    coverage: UsageCoverage;
    confidence: UsageConfidence;
    step_count: number;
    tokens: ExecutionTokenUsage;
    monetary?: {
        usd: number;
        source: MonetaryUsageSource;
        confidence: MonetaryUsageConfidence;
    };
}
export interface ExecutionUsageObservation extends HostUsageObservation {
    observation_id: string;
    worker_id: string;
    execution_unit_id: string;
    attempt_ordinal: number;
    generation: number;
    source_session_id: string;
}
export declare function executionUsageObservationId(input: {
    workerId: string;
    executionUnitId: string;
    attemptOrdinal: number;
    generation: number;
    sessionId: string;
    messageId?: string;
}): string;
export declare function isExecutionTokenUsage(v: unknown): v is ExecutionTokenUsage;
export declare function isHostUsageObservation(v: unknown): v is HostUsageObservation;
export declare function isExecutionUsageObservation(v: unknown): v is ExecutionUsageObservation;
export declare function addTokenUsage(a: ExecutionTokenUsage, b: ExecutionTokenUsage): ExecutionTokenUsage;
export declare const EMPTY_TOKEN_USAGE: ExecutionTokenUsage;
