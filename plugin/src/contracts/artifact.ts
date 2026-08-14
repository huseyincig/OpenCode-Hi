import { createHash } from 'node:crypto'

export const ARTIFACT_RETENTION_CLASSES=['session','project'] as const
export type ArtifactRetentionClass=typeof ARTIFACT_RETENTION_CLASSES[number]
export const ARTIFACT_PRIVACY_CLASSES=['project-private','redacted'] as const
export type ArtifactPrivacyClass=typeof ARTIFACT_PRIVACY_CLASSES[number]
export const ARTIFACT_FRESHNESS=['FRESH','POTENTIALLY_STALE'] as const
export type ArtifactFreshness=typeof ARTIFACT_FRESHNESS[number]

export interface ArtifactProvenance { source_files:string[] }
export interface ArtifactContract {
  artifact_id:string
  kind:string
  content_ref:'inline-body'
  content:string
  content_hash:string
  summary:string
  producer:string
  provenance:ArtifactProvenance
  created_at:number
  retention_class:ArtifactRetentionClass
  privacy_class:ArtifactPrivacyClass
  consumer_refs:string[]
  freshness:ArtifactFreshness
}

const KEYS=new Set(['artifact_id','kind','content_ref','content','content_hash','summary','producer','provenance','created_at','retention_class','privacy_class','consumer_refs','freshness'])
const RETENTION=new Set<string>(ARTIFACT_RETENTION_CLASSES),PRIVACY=new Set<string>(ARTIFACT_PRIVACY_CLASSES),FRESHNESS=new Set<string>(ARTIFACT_FRESHNESS)
function record(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function strings(v:unknown):v is string[]{return Array.isArray(v)&&v.every(x=>typeof x==='string')}
export function artifactContentHash(content:string):string{return createHash('sha256').update(content).digest('hex')}
let artifactSequence=0
export function newArtifactId():string{artifactSequence+=1;const entropy=`${Date.now()}\0${Math.random()}\0${artifactSequence}`;return`a_${createHash('sha256').update(entropy).digest('hex').slice(0,24)}`}
export function isArtifactContract(v:unknown):v is ArtifactContract{
  if(!record(v)||!Object.keys(v).every(k=>KEYS.has(k))||typeof v.artifact_id!=='string'||!/^a_[a-f0-9]{24}$/.test(v.artifact_id)||typeof v.kind!=='string'||!v.kind||v.content_ref!=='inline-body'||typeof v.content!=='string'||typeof v.content_hash!=='string'||typeof v.summary!=='string'||typeof v.producer!=='string'||!v.producer)return false
  if(v.content_hash!==artifactContentHash(v.content))return false
  if(!record(v.provenance)||!Object.keys(v.provenance).every(k=>k==='source_files')||!strings(v.provenance.source_files))return false
  if(typeof v.created_at!=='number'||!Number.isFinite(v.created_at)||typeof v.retention_class!=='string'||!RETENTION.has(v.retention_class)||typeof v.privacy_class!=='string'||!PRIVACY.has(v.privacy_class)||!strings(v.consumer_refs)||typeof v.freshness!=='string'||!FRESHNESS.has(v.freshness))return false
  return true
}
