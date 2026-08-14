export interface ProviderDuplicatePruningResult<T = any> {
    messages: T[];
    pruned_call_ids: string[];
    before_chars: number;
    after_chars: number;
}
export interface ProviderDuplicatePruningOptions {
    min_output_chars?: number;
}
export declare function providerToolOutputSignature(part: any): string | undefined;
export declare function pruneDuplicateProviderToolOutputs<T = any>(messages: T[], options?: ProviderDuplicatePruningOptions): ProviderDuplicatePruningResult<T>;
