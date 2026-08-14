export type ContextBudgetUnit = 'tokens' | 'characters';
export type ContextBudgetSource = 'host-observed' | 'provider-usage' | 'estimated' | 'fallback';
export type ContextBudgetConfidence = 'exact' | 'estimated';
export interface ContextBudgetEstimate {
    value: number;
    unit: ContextBudgetUnit;
    source: ContextBudgetSource;
    confidence: ContextBudgetConfidence;
}
export interface ContextBudgetObservation extends ContextBudgetEstimate {
    source: 'host-observed' | 'provider-usage';
    confidence: 'exact';
    model_identity?: string;
}
export interface ContextBudgetInput {
    content: string | string[];
    observed?: ContextBudgetObservation;
}
export interface ContextBudgetEstimator {
    estimate(input: ContextBudgetInput | string | string[], model?: string | {
        id: string;
    }): ContextBudgetEstimate;
}
export declare class DefaultContextBudgetEstimator implements ContextBudgetEstimator {
    estimate(input: ContextBudgetInput | string | string[], model?: string | {
        id: string;
    }): ContextBudgetEstimate;
}
export declare const contextBudgetEstimator: ContextBudgetEstimator;
export declare function providerUsageObservation(messages: any[]): ContextBudgetObservation | undefined;
