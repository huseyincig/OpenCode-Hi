import { WORKER_EVIDENCE_KINDS,type EvidenceOutcome } from './evidence-kinds.js'

export const MISSION_EVIDENCE_KINDS=[...WORKER_EVIDENCE_KINDS,'review-input','lsp-diagnostics'] as const
export type MissionEvidenceKind = typeof MISSION_EVIDENCE_KINDS[number]

export interface EvidenceProducerAttempt {
  worker_id:string
  execution_unit_id:string
  attempt_id:string
  run_id:string
  ordinal:number
  generation:number
}

export const EVIDENCE_SOURCE_CLASSES=['host-tool-observation','host-diff-observation','browser-observation','reviewer-observation','user-admitted-observation','runtime-observation'] as const
export type EvidenceSourceClass = typeof EVIDENCE_SOURCE_CLASSES[number]

export interface EvidenceItem {
  id:string
  kind:MissionEvidenceKind
  summary:string
  scope:string[]
  source?:string
  trusted_source_class?:EvidenceSourceClass
  source_session_id?:string
  source_state_hash?:string
  scope_state_hash?:string
  task_id?:string
  obligation_ids?:string[]
  evidence_refs?:string[]
  producer_attempt?:EvidenceProducerAttempt
  observed_at:number
  invalidated_at?:number
  pass?:boolean
  outcome?:EvidenceOutcome
  reason?:string
}

const KIND_SET=new Set<string>(MISSION_EVIDENCE_KINDS)
const OUTCOME_SET=new Set<string>(['pending','passed','failed','environment-issue'])
const SOURCE_CLASS_SET=new Set<string>(EVIDENCE_SOURCE_CLASSES)
const KEYS=new Set(['id','kind','summary','scope','source','trusted_source_class','source_session_id','source_state_hash','scope_state_hash','task_id','obligation_ids','evidence_refs','producer_attempt','observed_at','invalidated_at','pass','outcome','reason'])
function record(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function strings(v:unknown):v is string[]{return Array.isArray(v)&&v.every(x=>typeof x==='string')}
export function isEvidenceItemContract(v:unknown):v is EvidenceItem{
  if(!record(v)||!Object.keys(v).every(k=>KEYS.has(k))||typeof v.id!=='string'||!v.id||typeof v.kind!=='string'||!KIND_SET.has(v.kind)||typeof v.summary!=='string'||!strings(v.scope)||typeof v.observed_at!=='number'||!Number.isFinite(v.observed_at))return false
  for(const key of ['source','source_session_id','source_state_hash','scope_state_hash','task_id','reason'] as const)if(v[key]!==undefined&&typeof v[key]!=='string')return false
  const scopeStateHash=v.scope_state_hash;if(scopeStateHash!==undefined&&(typeof scopeStateHash!=='string'||!/^[a-f0-9]{64}$/i.test(scopeStateHash)))return false
  if(v.trusted_source_class!==undefined&&(typeof v.trusted_source_class!=='string'||!SOURCE_CLASS_SET.has(v.trusted_source_class)))return false
  if(v.obligation_ids!==undefined&&!strings(v.obligation_ids))return false
  if(v.evidence_refs!==undefined&&(!strings(v.evidence_refs)||v.evidence_refs.length>20))return false
  if(v.producer_attempt!==undefined){const p=v.producer_attempt;if(!record(p)||!Object.keys(p).every(k=>['worker_id','execution_unit_id','attempt_id','run_id','ordinal','generation'].includes(k))||Object.keys(p).length!==6||typeof p.worker_id!=='string'||!p.worker_id||typeof p.execution_unit_id!=='string'||!p.execution_unit_id||typeof p.attempt_id!=='string'||!p.attempt_id||typeof p.run_id!=='string'||!p.run_id||!Number.isInteger(p.ordinal)||Number(p.ordinal)<0||!Number.isInteger(p.generation)||Number(p.generation)<1)return false}
  if(v.invalidated_at!==undefined&&(typeof v.invalidated_at!=='number'||!Number.isFinite(v.invalidated_at)))return false
  if(v.pass!==undefined&&typeof v.pass!=='boolean')return false
  return v.outcome===undefined||(typeof v.outcome==='string'&&OUTCOME_SET.has(v.outcome))
}
