import { createHash } from 'node:crypto'

export const HUMAN_DECISION_TYPES=['preference','ambiguity','value_judgment','credential_action','authority_request','operational_action'] as const
export const HUMAN_DECISION_RESPONSE_KINDS=['free-text','choice','external-action','authority-protocol'] as const
export const HUMAN_DECISION_STATUSES=['OPEN','RESOLVED'] as const
export type HumanDecisionType=typeof HUMAN_DECISION_TYPES[number]
export type HumanDecisionResponseKind=typeof HUMAN_DECISION_RESPONSE_KINDS[number]
export type HumanDecisionStatus=typeof HUMAN_DECISION_STATUSES[number]

export interface HumanDecisionScope{mission_id:string;task_id?:string;worker_id?:string}
export interface HumanDecisionResponseSchema{kind:HumanDecisionResponseKind;protocol?:'approve-exact-action'|'reconcile-action-outcome'|'new-exact-action-contract';choices?:string[]}
export interface HumanDecisionContract{
  decision_id:string
  semantic_type:HumanDecisionType
  reason_code:string
  summary:string
  blocking_scope:HumanDecisionScope
  response_schema:HumanDecisionResponseSchema
  authority_ref?:string
  status:HumanDecisionStatus
  created_at:number
  resolved_at?:number
  resolution?:string
}

const TYPES=new Set<string>(HUMAN_DECISION_TYPES),KINDS=new Set<string>(HUMAN_DECISION_RESPONSE_KINDS),STATUSES=new Set<string>(HUMAN_DECISION_STATUSES)
const KEYS=new Set(['decision_id','semantic_type','reason_code','summary','blocking_scope','response_schema','authority_ref','status','created_at','resolved_at','resolution'])
const SCOPE_KEYS=new Set(['mission_id','task_id','worker_id']),RESPONSE_KEYS=new Set(['kind','protocol','choices'])
const PROTOCOLS=new Set(['approve-exact-action','reconcile-action-outcome','new-exact-action-contract'])
function record(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function finite(v:unknown):v is number{return typeof v==='number'&&Number.isFinite(v)}
function nonempty(v:unknown):v is string{return typeof v==='string'&&Boolean(v.trim())}
function validScope(v:unknown):v is HumanDecisionScope{return record(v)&&Object.keys(v).every(k=>SCOPE_KEYS.has(k))&&nonempty(v.mission_id)&&(v.task_id===undefined||nonempty(v.task_id))&&(v.worker_id===undefined||nonempty(v.worker_id))}
function validResponse(v:unknown):v is HumanDecisionResponseSchema{
  if(!record(v)||!Object.keys(v).every(k=>RESPONSE_KEYS.has(k))||typeof v.kind!=='string'||!KINDS.has(v.kind))return false
  if(v.protocol!==undefined&&(typeof v.protocol!=='string'||!PROTOCOLS.has(v.protocol)))return false
  if(v.choices!==undefined&&(!Array.isArray(v.choices)||v.choices.length<2||v.choices.length>12||!v.choices.every(nonempty)||new Set(v.choices).size!==v.choices.length))return false
  if(v.kind==='choice'&&!Array.isArray(v.choices))return false
  if(v.kind!=='choice'&&v.choices!==undefined)return false
  if(v.kind==='authority-protocol'&&!nonempty(v.protocol))return false
  if(v.kind!=='authority-protocol'&&v.protocol!==undefined)return false
  return true
}
export function humanDecisionId(input:{semantic_type:HumanDecisionType;reason_code:string;blocking_scope:HumanDecisionScope;authority_ref?:string}):string{
  const scope=[input.blocking_scope.mission_id,input.blocking_scope.task_id??'',input.blocking_scope.worker_id??''].join('\0')
  return`hd_${createHash('sha256').update(`${input.semantic_type}\0${input.reason_code}\0${scope}\0${input.authority_ref??''}`).digest('hex').slice(0,20)}`
}
export function isHumanDecisionContract(v:unknown):v is HumanDecisionContract{
  if(!record(v)||!Object.keys(v).every(k=>KEYS.has(k))||typeof v.decision_id!=='string'||!/^hd_[a-f0-9]{20}$/.test(v.decision_id)||typeof v.semantic_type!=='string'||!TYPES.has(v.semantic_type)||!nonempty(v.reason_code)||!nonempty(v.summary)||!validScope(v.blocking_scope)||!validResponse(v.response_schema)||typeof v.status!=='string'||!STATUSES.has(v.status)||!finite(v.created_at)||(v.created_at as number)<=0)return false
  if(v.authority_ref!==undefined&&!nonempty(v.authority_ref))return false
  const authorityDecision=v.semantic_type==='authority_request',response=v.response_schema as HumanDecisionResponseSchema
  if(authorityDecision&&(!nonempty(v.authority_ref)||response.kind!=='authority-protocol'))return false
  if(!authorityDecision&&(v.authority_ref!==undefined||response.kind==='authority-protocol'))return false
  if(v.resolved_at!==undefined&&(!finite(v.resolved_at)||(v.resolved_at as number)<(v.created_at as number)))return false
  if(v.resolution!==undefined&&!nonempty(v.resolution))return false
  if(v.status==='OPEN'&&(v.resolved_at!==undefined||v.resolution!==undefined))return false
  if(v.status==='RESOLVED'&&(v.resolved_at===undefined||v.resolution===undefined))return false
  const scope=v.blocking_scope as HumanDecisionScope,expected=humanDecisionId({semantic_type:v.semantic_type as HumanDecisionType,reason_code:v.reason_code as string,blocking_scope:scope,authority_ref:v.authority_ref as string|undefined})
  return v.decision_id===expected
}
