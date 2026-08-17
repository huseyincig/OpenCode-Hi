export type UsageTokenSource='opencode-step-finish'|'opencode-assistant-message'
export type UsageCoverage='assistant-step-total'|'assistant-message-reported'
export type UsageConfidence='exact'
export type MonetaryUsageSource='opencode-calculated'|'provider-billed'
export type MonetaryUsageConfidence='derived'|'exact'

export interface ExecutionTokenUsage{
  input:number
  output:number
  reasoning:number
  cache_read:number
  cache_write:number
}
export interface HostUsageObservation{
  message_id?:string
  model_identity?:string
  observed_at?:number
  token_source:UsageTokenSource
  coverage:UsageCoverage
  confidence:UsageConfidence
  step_count:number
  tokens:ExecutionTokenUsage
  monetary?:{usd:number;source:MonetaryUsageSource;confidence:MonetaryUsageConfidence}
}
export interface ExecutionUsageObservation extends HostUsageObservation{
  observation_id:string
  worker_id:string
  execution_unit_id:string
  attempt_ordinal:number
  generation:number
  source_session_id:string
}

function finiteNonNegative(v:unknown):v is number{return typeof v==='number'&&Number.isFinite(v)&&v>=0}
function record(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
export function executionUsageObservationId(input:{workerId:string;executionUnitId:string;attemptOrdinal:number;generation:number;sessionId:string;messageId?:string}):string{
  const part=(v:string)=>`${v.length}:${v}`
  return['usage1',input.executionUnitId,input.workerId,`g${input.generation}`,`a${input.attemptOrdinal}`,input.sessionId,input.messageId??'message-unknown'].map(x=>part(String(x))).join('|')
}
export function isExecutionTokenUsage(v:unknown):v is ExecutionTokenUsage{return record(v)&&Object.keys(v).length===5&&['input','output','reasoning','cache_read','cache_write'].every(k=>finiteNonNegative(v[k]))}
export function isHostUsageObservation(v:unknown):v is HostUsageObservation{
  if(!record(v))return false
  const keys=new Set(['message_id','model_identity','observed_at','token_source','coverage','confidence','step_count','tokens','monetary'])
  if(Object.keys(v).some(k=>!keys.has(k)))return false
  if(v.message_id!==undefined&&(typeof v.message_id!=='string'||!v.message_id))return false
  if(v.model_identity!==undefined&&(typeof v.model_identity!=='string'||!v.model_identity))return false
  if(v.observed_at!==undefined&&!finiteNonNegative(v.observed_at))return false
  if(!['opencode-step-finish','opencode-assistant-message'].includes(String(v.token_source))||!['assistant-step-total','assistant-message-reported'].includes(String(v.coverage))||v.confidence!=='exact'||!Number.isInteger(v.step_count)||Number(v.step_count)<1||!isExecutionTokenUsage(v.tokens))return false
  if(v.monetary!==undefined){const m=v.monetary;if(!record(m)||Object.keys(m).some(k=>!['usd','source','confidence'].includes(k))||!finiteNonNegative(m.usd)||!['opencode-calculated','provider-billed'].includes(String(m.source))||!['derived','exact'].includes(String(m.confidence)))return false;if(m.source==='opencode-calculated'&&m.confidence!=='derived')return false;if(m.source==='provider-billed'&&m.confidence!=='exact')return false}
  return true
}
export function isExecutionUsageObservation(v:unknown):v is ExecutionUsageObservation{
  if(!record(v))return false
  const base:Record<string,unknown>={...v};for(const k of ['observation_id','worker_id','execution_unit_id','attempt_ordinal','generation','source_session_id'])delete base[k]
  if(!isHostUsageObservation(base))return false
  if(typeof v.observation_id!=='string'||!v.observation_id.startsWith('6:usage1|')||typeof v.worker_id!=='string'||!v.worker_id||typeof v.execution_unit_id!=='string'||!v.execution_unit_id||!Number.isInteger(v.attempt_ordinal)||Number(v.attempt_ordinal)<1||!Number.isInteger(v.generation)||Number(v.generation)<1||typeof v.source_session_id!=='string'||!v.source_session_id)return false
  return v.observation_id===executionUsageObservationId({workerId:v.worker_id,executionUnitId:v.execution_unit_id,attemptOrdinal:Number(v.attempt_ordinal),generation:Number(v.generation),sessionId:v.source_session_id,messageId:typeof v.message_id==='string'?v.message_id:undefined})
}

export function addTokenUsage(a:ExecutionTokenUsage,b:ExecutionTokenUsage):ExecutionTokenUsage{return{input:a.input+b.input,output:a.output+b.output,reasoning:a.reasoning+b.reasoning,cache_read:a.cache_read+b.cache_read,cache_write:a.cache_write+b.cache_write}}
export const EMPTY_TOKEN_USAGE:ExecutionTokenUsage={input:0,output:0,reasoning:0,cache_read:0,cache_write:0}
