import type {MissionState} from '../mission/types.js'
import {appendLedger} from '../ledger/ledger.js'
import {durableProgressKey,NON_PROGRESS_TOOL_NAMES} from './progress-classifier.js'

export const DEFAULT_NO_PROGRESS_WINDOW_MS=120_000
export type VerifiedInflight='YES'|'NO'|'UNKNOWN'
export type LivenessState='ACTIVE'|'STALLED'|'RECONCILE'|'TERMINAL'
export type ExactExecutionState='ACTIVE'|'UNKNOWN'|'QUIESCENT'|'VERIFIED_ABORTED'
export interface ProcessLivenessObservation{pid_alive?:boolean;owner_verified:boolean;status:'running'|'exited'|'unknown'}
export interface MissionLivenessObservation{
  now?:number
  noProgressWindowMs?:number
  hostSessions?:Record<string,'idle'|'busy'|'retry'|'unknown'>
  processes?:Record<string,ProcessLivenessObservation>
}
export interface MissionLivenessAssessment{
  state:LivenessState
  inflight:VerifiedInflight
  last_durable_progress_at:number
  no_progress_ms:number
  no_progress_window_ms:number
  destructive_recovery_allowed:boolean
  reasons:string[]
}
export interface ToolOperationIdentity{operation_id:string;session_id:string;tool:string;generation:number}

export function lastDurableProgressAt(m:MissionState):number{
  const seen=new Set<string>();let latest=Math.max(0,Number(m.identity.created_at)||0)
  for(const event of [...m.execution.ledger].sort((a,b)=>a.at-b.at)){
    const key=durableProgressKey(event,m.continuation.generation);if(!key||seen.has(key))continue
    seen.add(key);latest=Math.max(latest,event.at)
  }
  return latest
}

function toolInflight(m:MissionState,host:Record<string,'idle'|'busy'|'retry'|'unknown'>):VerifiedInflight{
  const latestRestore=Math.max(0,...m.execution.ledger.filter(e=>e.type==='mission.restored').map(e=>e.at))
  const states=new Map<string,{started:number;result?:number;session_id:string}>()
  for(const event of m.execution.ledger){
    if(event.type!=='tool.operation-started'&&event.type!=='tool.operation-result')continue
    if(Number(event.payload?.generation)!==m.continuation.generation)continue
    const op=String(event.payload?.operation_id??''),tool=String(event.payload?.tool??'');if(!op||NON_PROGRESS_TOOL_NAMES.has(tool))continue
    const current=states.get(op)??{started:0,session_id:String(event.payload?.session_id??'')};if(event.type==='tool.operation-started'){current.started=Math.max(current.started,event.at);current.session_id=String(event.payload?.session_id??current.session_id)}else current.result=Math.max(current.result??0,event.at);states.set(op,current)
  }
  let unknown=false
  for(const state of states.values())if(state.started>(state.result??0)){if(latestRestore&&state.started<latestRestore){unknown=true;continue}const status=host[state.session_id]??'unknown';if(status==='busy'||status==='retry')return'YES';if(status!=='idle')unknown=true}
  return unknown?'UNKNOWN':'NO'
}

function mergeInflight(values:VerifiedInflight[]):VerifiedInflight{return values.includes('YES')?'YES':values.includes('UNKNOWN')?'UNKNOWN':'NO'}

function workerInflight(m:MissionState,host:Record<string,'idle'|'busy'|'retry'|'unknown'>):{state:VerifiedInflight;reasons:string[]}{
  const reasons:string[]=[],states:VerifiedInflight[]=[]
  for(const worker of m.execution.workers){
    if(['completed','failed','cancelled'].includes(worker.status))continue
    if(worker.generation_at_spawn!==undefined&&worker.generation_at_spawn!==m.continuation.generation)continue
    if(!worker.session_id){if(['starting','busy'].includes(worker.status)){states.push('UNKNOWN');reasons.push(`worker-session-unverified:${worker.id}`)}continue}
    const status=host[worker.session_id]??'unknown'
    if(status==='busy'||status==='retry'){states.push('YES');reasons.push(`host-session-${status}:${worker.id}`);continue}
    if(status==='unknown'){states.push('UNKNOWN');reasons.push(`host-session-unknown:${worker.id}`);continue}
    if(worker.restart_reconcile_pending||['starting','busy'].includes(worker.status)){states.push('UNKNOWN');reasons.push(`host-session-idle-reconcile:${worker.id}`)}
  }
  return{state:mergeInflight(states),reasons}
}

function processInflight(m:MissionState,observed:Record<string,ProcessLivenessObservation>):{state:VerifiedInflight;reasons:string[]}{
  const states:VerifiedInflight[]=[],reasons:string[]=[]
  for(const process of m.execution.processes){
    if(process.status!=='RUNNING')continue
    const live=observed[process.process_id]
    if(!live||!live.owner_verified){states.push('UNKNOWN');reasons.push(`process-owner-unverified:${process.process_id}`);continue}
    if(live.status==='running'){states.push('YES');reasons.push(`process-running:${process.process_id}`)}
    else if(live.status==='unknown'){states.push('UNKNOWN');reasons.push(`process-state-unknown:${process.process_id}`)}
  }
  return{state:mergeInflight(states),reasons}
}

export function assessMissionLiveness(m:MissionState,observation:MissionLivenessObservation={}):MissionLivenessAssessment{
  const now=observation.now??Date.now(),window=Math.max(1,Math.floor(observation.noProgressWindowMs??DEFAULT_NO_PROGRESS_WINDOW_MS)),last=lastDurableProgressAt(m),noProgress=Math.max(0,now-last)
  if(['completed','stopped','failed'].includes(m.identity.status))return{state:'TERMINAL',inflight:'NO',last_durable_progress_at:last,no_progress_ms:noProgress,no_progress_window_ms:window,destructive_recovery_allowed:false,reasons:['execution-terminal']}
  const host=observation.hostSessions??{},tool=toolInflight(m,host),workers=workerInflight(m,host),processes=processInflight(m,observation.processes??{}),inflight=mergeInflight([tool,workers.state,processes.state]),reasons=[...workers.reasons,...processes.reasons]
  if(tool==='YES')reasons.push('current-tool-operation');else if(tool==='UNKNOWN')reasons.push('tool-operation-reconcile')
  if(inflight==='UNKNOWN')return{state:'RECONCILE',inflight,last_durable_progress_at:last,no_progress_ms:noProgress,no_progress_window_ms:window,destructive_recovery_allowed:false,reasons}
  if(inflight==='YES')return{state:'ACTIVE',inflight,last_durable_progress_at:last,no_progress_ms:noProgress,no_progress_window_ms:window,destructive_recovery_allowed:false,reasons}
  const stalled=noProgress>=window
  return{state:stalled?'STALLED':'ACTIVE',inflight:'NO',last_durable_progress_at:last,no_progress_ms:noProgress,no_progress_window_ms:window,destructive_recovery_allowed:stalled,reasons:[...reasons,stalled?'no-durable-progress-window-exceeded':'within-no-progress-window']}
}

export function recordToolOperationProgress(m:MissionState,identity:ToolOperationIdentity,phase:'started'|'result',at=Date.now()):boolean{
  if(identity.generation!==m.continuation.generation||!identity.operation_id.trim()||NON_PROGRESS_TOOL_NAMES.has(identity.tool))return false
  const type=phase==='started'?'tool.operation-started':'tool.operation-result'
  if(m.execution.ledger.some(e=>e.type===type&&String(e.payload?.operation_id??'')===identity.operation_id&&Number(e.payload?.generation)===identity.generation))return false
  const event=appendLedger(m,type,{payload:{operation_id:identity.operation_id,session_id:identity.session_id,tool:identity.tool,generation:identity.generation}});event.at=at
  return true
}

export function recordAssistantProgress(m:MissionState,input:{worker_id:string;task_id:string;session_id:string;generation:number;message_id?:string;observed_at:number;output_tokens:number;reasoning_tokens:number;tool_calls:number;text_chars:number}):boolean{
  if(input.generation!==m.continuation.generation)return false
  const activityKey=[input.session_id,input.message_id??'',input.output_tokens,input.reasoning_tokens,input.tool_calls,input.text_chars].join(':')
  if(!input.message_id&&!input.output_tokens&&!input.reasoning_tokens&&!input.tool_calls&&!input.text_chars)return false
  if(m.execution.ledger.some(e=>e.type==='assistant.progress-observed'&&e.payload?.activity_key===activityKey))return false
  const event=appendLedger(m,'assistant.progress-observed',{task_id:input.task_id,worker_id:input.worker_id,payload:{activity_key:activityKey,session_id:input.session_id,message_id:input.message_id,generation:input.generation,output_tokens:input.output_tokens,reasoning_tokens:input.reasoning_tokens,tool_calls:input.tool_calls,text_chars:input.text_chars}});event.at=input.observed_at
  return true
}

export function replacementExecutionAdmission(state:ExactExecutionState):boolean{return state==='QUIESCENT'||state==='VERIFIED_ABORTED'}
