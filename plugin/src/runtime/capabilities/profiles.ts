export type CapabilityProfileName='SAFE'|'STANDARD'|'RESEARCH'|'RELEASE'|'SANDBOX'
export interface CapabilityProfile{name:CapabilityProfileName;read:boolean;write:boolean;shell:boolean;network:boolean;externalSideEffects:boolean;requiresAuthority:boolean;requiresIsolation:boolean}
export const CAPABILITY_PROFILES:Record<CapabilityProfileName,CapabilityProfile>={
 SAFE:{name:'SAFE',read:true,write:false,shell:false,network:false,externalSideEffects:false,requiresAuthority:false,requiresIsolation:false},
 STANDARD:{name:'STANDARD',read:true,write:true,shell:true,network:true,externalSideEffects:false,requiresAuthority:false,requiresIsolation:false},
 RESEARCH:{name:'RESEARCH',read:true,write:false,shell:false,network:true,externalSideEffects:false,requiresAuthority:false,requiresIsolation:false},
 RELEASE:{name:'RELEASE',read:true,write:true,shell:true,network:true,externalSideEffects:true,requiresAuthority:true,requiresIsolation:false},
 SANDBOX:{name:'SANDBOX',read:true,write:true,shell:true,network:false,externalSideEffects:false,requiresAuthority:false,requiresIsolation:true},
}
export function capabilityProfile(name:CapabilityProfileName):CapabilityProfile{return {...CAPABILITY_PROFILES[name]}}
