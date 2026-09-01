export interface ProjectMemoryRecallRequest {
  project_root:string
  query:string
  max_items:number
  max_chars:number
  max_age_ms:number
  now:number
}

export interface ProjectMemoryProviderRecord {
  id:string
  project_root:string
  content:string
  observed_at:number
  expires_at?:number
  source_uri?:string
  tags?:string[]
  confidence?:number
}

/**
 * Optional broad-memory adapter owned by an external/local memory provider.
 * Hi never assumes persistence, ranking, embedding, credentials or storage
 * ownership from this interface and never promotes returned records to Evidence.
 */
export interface ProjectMemoryProvider {
  id:string
  recall(request:ProjectMemoryRecallRequest):Promise<readonly ProjectMemoryProviderRecord[]>
}

export interface ProjectMemoryProjectionItem {
  provider_id:string
  id:string
  content:string
  observed_at:number
  age_ms:number
  source_uri?:string
  tags:string[]
  confidence?:number
}

export interface ProjectMemoryProjection {
  status:'DISABLED'|'READY'|'DEGRADED'
  provider_id?:string
  items:ProjectMemoryProjectionItem[]
  dropped:{invalid:number;cross_project:number;stale:number;expired:number;over_budget:number}
  advisory:true
  evidence_authority:false
  routing_authority:false
  completion_authority:false
  action_authority:false
  persistence_owner:'provider-or-none'
  claim_boundary:'bounded-provider-memory-projection'
}
