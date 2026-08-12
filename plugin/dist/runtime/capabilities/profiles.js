export const CAPABILITY_PROFILES = {
    SAFE: { name: 'SAFE', read: true, write: false, shell: false, network: false, externalSideEffects: false, requiresAuthority: false, requiresIsolation: false },
    STANDARD: { name: 'STANDARD', read: true, write: true, shell: true, network: true, externalSideEffects: false, requiresAuthority: false, requiresIsolation: false },
    RESEARCH: { name: 'RESEARCH', read: true, write: false, shell: false, network: true, externalSideEffects: false, requiresAuthority: false, requiresIsolation: false },
    RELEASE: { name: 'RELEASE', read: true, write: true, shell: true, network: true, externalSideEffects: true, requiresAuthority: true, requiresIsolation: false },
    SANDBOX: { name: 'SANDBOX', read: true, write: true, shell: true, network: false, externalSideEffects: false, requiresAuthority: false, requiresIsolation: true },
};
export function capabilityProfile(name) { return { ...CAPABILITY_PROFILES[name] }; }
