export interface ConcurrencyPolicy {
    global: number;
    providers?: Record<string, number>;
    models?: Record<string, number>;
}
export interface ConcurrencyPolicySource {
    policySnapshot(): ConcurrencyPolicy;
}
export declare function createConcurrencyPolicySource(policy: () => ConcurrencyPolicy): ConcurrencyPolicySource;
export declare class ConcurrencyScheduler implements ConcurrencyPolicySource {
    #private;
    private policy;
    constructor(policy: () => ConcurrencyPolicy);
    canStart(id: string, provider?: string, model?: string): {
        ok: boolean;
        reason: string;
    };
    acquire(id: string, provider?: string, model?: string): boolean;
    release(id: string): void;
    running(): number;
    policySnapshot(): ConcurrencyPolicy;
    allocations(): Array<{
        id: string;
        provider?: string;
        model?: string;
    }>;
}
