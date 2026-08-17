export interface ModelCapabilityProfile {
    id: string;
    provider?: string;
    cost?: number;
    quality?: number;
    writeCapable?: boolean;
    tags?: string[];
    expectedTurns?: number;
    contextOverhead?: number;
    variants?: string[];
    source?: 'runtime-inventory' | 'configured' | 'synthetic-host-default';
}
export interface NormalizedModelCapabilityProfile extends ModelCapabilityProfile {
    cost: number;
    quality: number;
    writeCapable: boolean;
    tags: string[];
    variants: string[];
    source: 'runtime-inventory' | 'configured' | 'synthetic-host-default';
}
export interface ModelIdentityRef {
    model?: string;
    variant?: string;
    source?: string;
}
export type ModelIdentityStatus = 'host-default-or-unconstrained' | 'projection-mismatch' | 'model-unverified' | 'model-mismatch' | 'variant-unverified' | 'variant-mismatch' | 'verified';
export interface ModelExecutionIdentity {
    requested?: ModelIdentityRef;
    selected?: ModelIdentityRef;
    projected?: ModelIdentityRef;
    observed?: ModelIdentityRef;
    effective?: ModelIdentityRef;
    modelVerified: boolean;
    variantVerified?: boolean;
    status: ModelIdentityStatus;
}
export declare function normalizeModelCapabilityProfile(value: unknown, source?: NormalizedModelCapabilityProfile['source'], field?: string): NormalizedModelCapabilityProfile;
export declare function reconcileModelExecutionIdentity(input: {
    requested?: ModelIdentityRef;
    selected?: ModelIdentityRef;
    projected?: ModelIdentityRef;
    observed?: ModelIdentityRef;
}): ModelExecutionIdentity;
