export interface ProviderPolicyView {
    allowed: Set<string>;
    denied: Set<string>;
    source: string[];
}
export declare function providerPolicyView(hostConfig: Record<string, unknown> | undefined): ProviderPolicyView;
