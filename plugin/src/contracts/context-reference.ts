import { createHash } from 'node:crypto'

export const CONTEXT_PRIORITIES=['low','normal','high'] as const
export const CONTEXT_PROTECTIONS=['PROTECTED','COMPRESSIBLE','PURGEABLE'] as const
export const CONTEXT_FRESHNESS=['FRESH','POTENTIALLY_STALE','UNKNOWN'] as const
export const CONTEXT_RETENTION=['task','mission'] as const
export const CONTEXT_PRIVACY=['project-private','redacted'] as const
export type ContextPriority=typeof CONTEXT_PRIORITIES[number]
export type ContextProtection=typeof CONTEXT_PROTECTIONS[number]
export type ContextFreshness=typeof CONTEXT_FRESHNESS[number]
export type ContextRetention=typeof CONTEXT_RETENTION[number]
export type ContextPrivacyClass=typeof CONTEXT_PRIVACY[number]

export interface ContextReferenceContract {
  id:string
  source_ref:string
  consumer_ref:string
  reason:string
  priority:ContextPriority
  protection:ContextProtection
  budget_cost:number
  freshness:ContextFreshness
  retention:ContextRetention
  privacy_class:ContextPrivacyClass
  kind:string
  title?:string
  summary?:string
  content_hash?:string
  source_handle_id?:string
}
export type ContextReferenceDraft=Omit<ContextReferenceContract,'id'|'consumer_ref'>

const KEYS=new Set(['id','source_ref','consumer_ref','reason','priority','protection','budget_cost','freshness','retention','privacy_class','kind','title','summary','content_hash','source_handle_id'])
const PRIORITY=new Set<string>(CONTEXT_PRIORITIES),PROTECTION=new Set<string>(CONTEXT_PROTECTIONS),FRESHNESS=new Set<string>(CONTEXT_FRESHNESS),RETENTION=new Set<string>(CONTEXT_RETENTION),PRIVACY=new Set<string>(CONTEXT_PRIVACY)
function record(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
export function bindContextReference(draft:ContextReferenceDraft,consumerRef:string):ContextReferenceContract{
  const identity=createHash('sha256').update(`${consumerRef}\0${draft.source_ref}\0${draft.reason}`).digest('hex').slice(0,20)
  return{id:`cr_${identity}`,consumer_ref:consumerRef,...draft}
}
export function isContextReferenceContract(v:unknown):v is ContextReferenceContract{
  if(!record(v)||!Object.keys(v).every(k=>KEYS.has(k))||typeof v.id!=='string'||!/^cr_[a-f0-9]{20}$/.test(v.id)||typeof v.source_ref!=='string'||!v.source_ref||typeof v.consumer_ref!=='string'||!v.consumer_ref||typeof v.reason!=='string'||!v.reason||typeof v.priority!=='string'||!PRIORITY.has(v.priority)||typeof v.protection!=='string'||!PROTECTION.has(v.protection)||typeof v.budget_cost!=='number'||!Number.isFinite(v.budget_cost)||v.budget_cost<0||typeof v.freshness!=='string'||!FRESHNESS.has(v.freshness)||typeof v.retention!=='string'||!RETENTION.has(v.retention)||typeof v.privacy_class!=='string'||!PRIVACY.has(v.privacy_class)||typeof v.kind!=='string'||!v.kind)return false
  for(const k of ['title','summary','content_hash','source_handle_id'])if(v[k]!==undefined&&typeof v[k]!=='string')return false
  return true
}
