import { WORKER_EVIDENCE_KINDS,type EvidenceOutcome } from './worker-result.js'

export const MISSION_EVIDENCE_KINDS=[...WORKER_EVIDENCE_KINDS,'review-input','lsp-diagnostics'] as const
export type MissionEvidenceKind = typeof MISSION_EVIDENCE_KINDS[number]

export interface EvidenceItem {
  id:string
  kind:MissionEvidenceKind
  summary:string
  scope:string[]
  source?:string
  source_session_id?:string
  source_state_hash?:string
  task_id?:string
  obligation_ids?:string[]
  observed_at:number
  invalidated_at?:number
  pass?:boolean
  outcome?:EvidenceOutcome
  reason?:string
}

const KIND_SET=new Set<string>(MISSION_EVIDENCE_KINDS)
const OUTCOME_SET=new Set<string>(['pending','passed','failed','environment-issue'])
const KEYS=new Set(['id','kind','summary','scope','source','source_session_id','source_state_hash','task_id','obligation_ids','observed_at','invalidated_at','pass','outcome','reason'])
function record(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function strings(v:unknown):v is string[]{return Array.isArray(v)&&v.every(x=>typeof x==='string')}
export function isEvidenceItemContract(v:unknown):v is EvidenceItem{
  if(!record(v)||!Object.keys(v).every(k=>KEYS.has(k))||typeof v.id!=='string'||!v.id||typeof v.kind!=='string'||!KIND_SET.has(v.kind)||typeof v.summary!=='string'||!strings(v.scope)||typeof v.observed_at!=='number'||!Number.isFinite(v.observed_at))return false
  for(const key of ['source','source_session_id','source_state_hash','task_id','reason'] as const)if(v[key]!==undefined&&typeof v[key]!=='string')return false
  if(v.obligation_ids!==undefined&&!strings(v.obligation_ids))return false
  if(v.invalidated_at!==undefined&&(typeof v.invalidated_at!=='number'||!Number.isFinite(v.invalidated_at)))return false
  if(v.pass!==undefined&&typeof v.pass!=='boolean')return false
  return v.outcome===undefined||(typeof v.outcome==='string'&&OUTCOME_SET.has(v.outcome))
}
