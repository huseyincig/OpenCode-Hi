export interface ConcurrencyPolicy { global:number; providers?:Record<string,number>; models?:Record<string,number> }
export interface ConcurrencyPolicySource { policySnapshot():ConcurrencyPolicy }
export function createConcurrencyPolicySource(policy:()=>ConcurrencyPolicy):ConcurrencyPolicySource{return{policySnapshot(){const p=policy();return{global:p.global,providers:{...(p.providers??{})},models:{...(p.models??{})}}}}}
