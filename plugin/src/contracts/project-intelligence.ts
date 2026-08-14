import { isSafeProjectFileSourceRef } from './common.js'
export const PROJECT_INTELLIGENCE_FRESHNESS=['FRESH','POTENTIALLY_STALE'] as const
export const PROJECT_INTELLIGENCE_LIFECYCLES=['ACTIVE','SUPERSEDED','ARCHIVED'] as const
export const PROJECT_INTELLIGENCE_CONSUMERS=['task-context'] as const
export type ProjectIntelligenceFreshness=typeof PROJECT_INTELLIGENCE_FRESHNESS[number]
export type ProjectIntelligenceLifecycle=typeof PROJECT_INTELLIGENCE_LIFECYCLES[number]
export type ProjectIntelligenceConsumer=typeof PROJECT_INTELLIGENCE_CONSUMERS[number]
export interface ProjectIntelligenceSourceRef { ref:string; hash:string }
export interface ProjectIntelligenceContract {
  id:string
  statement:string
  source_refs:ProjectIntelligenceSourceRef[]
  observed_commit?:string
  confidence:number
  freshness:ProjectIntelligenceFreshness
  lifecycle:ProjectIntelligenceLifecycle
  consumer_domains:ProjectIntelligenceConsumer[]
  updated_at:number
}
const KEYS=new Set(['id','statement','source_refs','observed_commit','confidence','freshness','lifecycle','consumer_domains','updated_at'])
const SOURCE_KEYS=new Set(['ref','hash'])
const FRESH=new Set<string>(PROJECT_INTELLIGENCE_FRESHNESS),LIFE=new Set<string>(PROJECT_INTELLIGENCE_LIFECYCLES),CONSUMERS=new Set<string>(PROJECT_INTELLIGENCE_CONSUMERS)
function record(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function validSource(v:unknown):v is ProjectIntelligenceSourceRef{return record(v)&&Object.keys(v).every(k=>SOURCE_KEYS.has(k))&&isSafeProjectFileSourceRef(v.ref)&&typeof v.hash==='string'&&/^[a-f0-9]{64}$/.test(v.hash)}
export function isProjectIntelligenceContract(v:unknown):v is ProjectIntelligenceContract{
  if(!record(v)||!Object.keys(v).every(k=>KEYS.has(k))||typeof v.id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(v.id)||typeof v.statement!=='string'||!v.statement.trim()||!Array.isArray(v.source_refs)||v.source_refs.length===0||!v.source_refs.every(validSource))return false
  if(new Set(v.source_refs.map(s=>s.ref)).size!==v.source_refs.length)return false
  if(v.observed_commit!==undefined&&(typeof v.observed_commit!=='string'||!v.observed_commit.trim()))return false
  if(typeof v.confidence!=='number'||!Number.isFinite(v.confidence)||v.confidence<0||v.confidence>1||typeof v.freshness!=='string'||!FRESH.has(v.freshness)||typeof v.lifecycle!=='string'||!LIFE.has(v.lifecycle)||!Array.isArray(v.consumer_domains)||v.consumer_domains.length===0||!v.consumer_domains.every(x=>typeof x==='string'&&CONSUMERS.has(x))||new Set(v.consumer_domains).size!==v.consumer_domains.length||typeof v.updated_at!=='number'||!Number.isFinite(v.updated_at)||v.updated_at<=0)return false
  return true
}
export function projectIntelligenceFiles(v:ProjectIntelligenceContract):string[]{return v.source_refs.map(x=>x.ref.slice(5))}
