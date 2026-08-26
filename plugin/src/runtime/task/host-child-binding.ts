import {executionAttemptIdentity,sameExecutionAttempt,type ExecutionAttemptIdentity} from '../../contracts/orchestration-core.js'
import type {MissionState,WorkerState} from '../mission/types.js'
import type {ChildSessionPort,HostChildSessionStatus} from '../host/port.js'

export interface HostChildBinding{
  missionId:string
  taskId:string
  workerId:string
  parentSessionId:string
  sessionId:string
  generation:number
  attempt:ExecutionAttemptIdentity
}

export type HostTerminalEventDecision='ACCEPT'|'WAIT'|'STALE'|'UNVERIFIED'
export interface HostTerminalEventAdmission{
  decision:HostTerminalEventDecision
  reason:string
  hostStatus:HostChildSessionStatus
  binding?:HostChildBinding
}

type BindingResolver=(m:MissionState,worker:WorkerState)=>HostChildBinding|undefined

function bindingForWorker(m:MissionState,worker:WorkerState,requireCurrentGeneration:boolean):HostChildBinding|undefined{
  const sessionId=worker.session_id,generation=worker.generation_at_spawn,ordinal=worker.attempt??0
  if(!sessionId||!Number.isInteger(generation)||generation<1||!Number.isInteger(ordinal)||ordinal<1)return undefined
  if(worker.parent_mission_id!==m.identity.mission_id||(requireCurrentGeneration&&generation!==m.continuation.generation))return undefined
  const attempt=executionAttemptIdentity({executionUnitId:`eu:${worker.task_id}`,workerId:worker.id,ordinal,generation})
  if(!requireCurrentGeneration){
    if(!worker.restart_reconcile_pending)return undefined
    const reservation=m.execution.scheduler?.reservations.find(item=>item.workerId===worker.id)
    if(reservation&&(reservation.hostExecutionId!==sessionId||!sameExecutionAttempt(reservation.attempt,attempt)))return undefined
  }
  return{missionId:m.identity.mission_id,taskId:worker.task_id,workerId:worker.id,parentSessionId:worker.parent_session_id,sessionId,generation,attempt}
}

function bindingMatches(m:MissionState,worker:WorkerState,binding:HostChildBinding,resolver:BindingResolver):boolean{
  const current=resolver(m,worker)
  return Boolean(current
    &&current.missionId===binding.missionId
    &&current.taskId===binding.taskId
    &&current.workerId===binding.workerId
    &&current.parentSessionId===binding.parentSessionId
    &&current.sessionId===binding.sessionId
    &&current.generation===binding.generation
    &&current.attempt.attemptId===binding.attempt.attemptId
    &&current.attempt.runId===binding.attempt.runId)
}

export function hostChildBinding(m:MissionState,worker:WorkerState):HostChildBinding|undefined{return bindingForWorker(m,worker,true)}

/**
 * Restart reconciliation may need to settle an immutable historical attempt after
 * the parent mission moved to a newer semantic generation. The worker's persisted
 * attempt identity remains authoritative; a matching scheduler reservation, when
 * present, must prove the same host session and exact attempt identity.
 */
export function restartHostChildBinding(m:MissionState,worker:WorkerState):HostChildBinding|undefined{return bindingForWorker(m,worker,false)}

export function hostChildBindingMatches(m:MissionState,worker:WorkerState,binding:HostChildBinding):boolean{return bindingMatches(m,worker,binding,hostChildBinding)}
export function restartHostChildBindingMatches(m:MissionState,worker:WorkerState,binding:HostChildBinding):boolean{return bindingMatches(m,worker,binding,restartHostChildBinding)}

async function admitBinding(m:MissionState,worker:WorkerState,host:ChildSessionPort,resolver:BindingResolver,matcher:(m:MissionState,w:WorkerState,b:HostChildBinding)=>boolean):Promise<HostTerminalEventAdmission>{
  const binding=resolver(m,worker)
  if(!binding)return{decision:'STALE',reason:'host-child-binding-unavailable',hostStatus:'unknown'}
  if(!host.capabilities.status)return{decision:'UNVERIFIED',reason:'host-session-status-capability-unavailable',hostStatus:'unknown',binding}
  const hostStatus=await host.status(binding.sessionId)
  if(!matcher(m,worker,binding))return{decision:'STALE',reason:'host-child-binding-changed-during-status-read',hostStatus,binding}
  if(hostStatus==='busy'||hostStatus==='retry')return{decision:'WAIT',reason:`host-session-${hostStatus}`,hostStatus,binding}
  if(hostStatus==='idle')return{decision:'ACCEPT',reason:'host-session-idle-confirmed',hostStatus,binding}
  return{decision:'UNVERIFIED',reason:'host-session-status-unverified',hostStatus,binding}
}

/**
 * Admit a host terminal event without creating a second execution-status owner.
 * OpenCode owns busy/retry/idle truth. Hi captures only the semantic attempt/session
 * fence, performs one read-only status projection, then revalidates the fence after
 * the await so a same-session newer attempt cannot be closed by a stale idle event.
 */
export async function admitHostTerminalEvent(m:MissionState,worker:WorkerState,host:ChildSessionPort):Promise<HostTerminalEventAdmission>{return admitBinding(m,worker,host,hostChildBinding,hostChildBindingMatches)}

/** Restart-only admission for a persisted historical attempt. Normal callbacks remain generation-fenced. */
export async function admitRestartHostTerminalEvent(m:MissionState,worker:WorkerState,host:ChildSessionPort):Promise<HostTerminalEventAdmission>{return admitBinding(m,worker,host,restartHostChildBinding,restartHostChildBindingMatches)}
