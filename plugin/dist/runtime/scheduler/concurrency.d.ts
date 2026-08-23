export interface ConcurrencyPolicy {
    global: number;
    providers?: Record<string, number>;
    models?: Record<string, number>;
}
export interface ConcurrencyPolicySource {
    policySnapshot(): ConcurrencyPolicy;
}
export declare function createConcurrencyPolicySource(policy: () => ConcurrencyPolicy): ConcurrencyPolicySource;
