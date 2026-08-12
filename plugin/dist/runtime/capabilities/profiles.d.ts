export type CapabilityProfileName = 'SAFE' | 'STANDARD' | 'RESEARCH' | 'RELEASE' | 'SANDBOX';
export interface CapabilityProfile {
    name: CapabilityProfileName;
    read: boolean;
    write: boolean;
    shell: boolean;
    network: boolean;
    externalSideEffects: boolean;
    requiresAuthority: boolean;
    requiresIsolation: boolean;
}
export declare const CAPABILITY_PROFILES: Record<CapabilityProfileName, CapabilityProfile>;
export declare function capabilityProfile(name: CapabilityProfileName): CapabilityProfile;
