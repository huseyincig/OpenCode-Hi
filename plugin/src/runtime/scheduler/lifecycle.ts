import type {
  ExecutionAttemptIdentity,
  SchedulerLifecycleEvent,
  SchedulerLifecycleResult,
  SchedulerLifecycleState,
  SchedulerReservation,
  SchedulingRunningAllocation,
  SchedulingSnapshot,
} from '../../contracts/orchestration-core.js'
import { executionAttemptIdentity,sameExecutionAttempt,schedulerReservationId,validateWorkGraph } from '../../contracts/orchestration-core.js'
import { planScheduling } from './planner.js'

function clone<T>(value:T):T{return structuredClone(value)}
function result(state:SchedulerLifecycleState,accepted:boolean,reason:string,reservation?:SchedulerReservation):SchedulerLifecycleResult{
  return{accepted,reason,state,reservation}
}
function exactAttempt(reservation:SchedulerReservation,attempt:ExecutionAttemptIdentity):boolean{return sameExecutionAttempt(reservation.attempt,attempt)}
function exactHost(reservation:SchedulerReservation,hostExecutionId?:string):boolean{
  return reservation.hostExecutionId===undefined||reservation.hostExecutionId===hostExecutionId
}
function updateReservation(state:SchedulerLifecycleState,reservation:SchedulerReservation):SchedulerLifecycleState{
  return{...state,revision:state.revision+1,reservations:state.reservations.map(item=>item.reservationId===reservation.reservationId?reservation:item)}
}
function removeReservation(state:SchedulerLifecycleState,id:string):SchedulerLifecycleState{
  return{...state,revision:state.revision+1,reservations:state.reservations.filter(item=>item.reservationId!==id)}
}

/** Pure reservation lifecycle. Host execution and persistence side effects live outside this reducer. */
export function reduceSchedulerLifecycle(input:SchedulerLifecycleState,event:SchedulerLifecycleEvent):SchedulerLifecycleResult{
  const state=clone(input)
  if(event.type==='RESTART_QUARANTINE'){
    const reservations=state.reservations.map(item=>({...item,phase:'RECONCILING' as const,updatedAt:event.at}))
    if(reservations.every((item,index)=>item.phase===state.reservations[index]?.phase))return result(state,true,'already-quarantined')
    return result({...state,revision:state.revision+1,reservations},true,'restart-quarantined')
  }
  if(event.type==='RESERVE'){
    if(event.missionId!==state.missionId)return result(state,false,'mission-mismatch')
    if(event.attempt.executionUnitId==='')return result(state,false,'execution-unit-missing')
    const expected=executionAttemptIdentity({executionUnitId:event.attempt.executionUnitId,workerId:event.workerId,ordinal:event.attempt.ordinal,generation:event.attempt.generation})
    if(!sameExecutionAttempt(event.attempt,expected))return result(state,false,'attempt-identity-invalid')
    const id=schedulerReservationId({missionId:event.missionId,workNodeId:event.workNodeId,attempt:event.attempt})
    const same=state.reservations.find(item=>item.reservationId===id)
    if(same)return result(state,true,'already-reserved',same)
    const occupied=state.reservations.find(item=>item.executionUnitId===event.attempt.executionUnitId)
    if(occupied)return result(state,false,'execution-unit-already-reserved',occupied)
    const reservation:SchedulerReservation={reservationId:id,missionId:event.missionId,workNodeId:event.workNodeId,executionUnitId:event.attempt.executionUnitId,workerId:event.workerId,attempt:clone(event.attempt),phase:'RESERVED',resource:clone(event.resource),ticket:state.nextTicket,reservedAt:event.at,updatedAt:event.at}
    return result({...state,revision:state.revision+1,nextTicket:state.nextTicket+1,reservations:[...state.reservations,reservation]},true,'reserved',reservation)
  }
  const current=state.reservations.find(item=>item.reservationId===event.reservationId)
  if(!current)return result(state,false,'reservation-not-found')
  if(!exactAttempt(current,event.attempt))return result(state,false,'stale-attempt',current)
  if(event.type==='HOST_BOUND'){
    if(current.phase!=='RESERVED'&&current.phase!=='RUNNING'&&current.phase!=='RECONCILING')return result(state,false,`invalid-phase:${current.phase}`,current)
    if(!event.hostExecutionId)return result(state,false,'host-execution-id-missing',current)
    if(current.hostExecutionId&&current.hostExecutionId!==event.hostExecutionId)return result(state,false,'host-execution-mismatch',current)
    const next={...current,phase:'RUNNING' as const,hostExecutionId:event.hostExecutionId,updatedAt:event.at}
    return result(updateReservation(state,next),true,current.phase==='RUNNING'?'already-running':'host-bound',next)
  }
  if(event.type==='RECONCILE'){
    if(current.phase!=='RECONCILING')return result(state,false,`invalid-phase:${current.phase}`,current)
    if(event.outcome==='UNKNOWN')return result(state,true,'reconcile-unknown',current)
    if(event.outcome==='NOT_STARTED'){
      if(current.hostExecutionId)return result(state,false,'not-started-conflicts-with-host-binding',current)
      return result(removeReservation(state,current.reservationId),true,'reconciled-not-started',current)
    }
    if(event.outcome==='ACTIVE'){
      if(!event.hostExecutionId)return result(state,false,'active-host-execution-required',current)
      if(current.hostExecutionId&&current.hostExecutionId!==event.hostExecutionId)return result(state,false,'host-execution-mismatch',current)
      const next={...current,phase:'RUNNING' as const,hostExecutionId:event.hostExecutionId,updatedAt:event.at}
      return result(updateReservation(state,next),true,'reconciled-active',next)
    }
    if(!event.hostExecutionId)return result(state,false,'terminal-host-execution-required',current)
    if(current.hostExecutionId&&current.hostExecutionId!==event.hostExecutionId)return result(state,false,'host-execution-mismatch',current)
    const next={...current,phase:'SETTLING' as const,hostExecutionId:event.hostExecutionId,updatedAt:event.at}
    return result(updateReservation(state,next),true,'reconciled-terminal',next)
  }
  if(!exactHost(current,event.hostExecutionId))return result(state,false,'stale-host-execution',current)
  if(event.type==='BEGIN_SETTLEMENT'){
    if(current.phase==='SETTLING')return result(state,true,'already-settling',current)
    if(current.phase!=='RUNNING'&&current.phase!=='RECONCILING')return result(state,false,`invalid-phase:${current.phase}`,current)
    if(current.hostExecutionId&&!event.hostExecutionId)return result(state,false,'host-execution-required',current)
    const next={...current,phase:'SETTLING' as const,updatedAt:event.at}
    return result(updateReservation(state,next),true,'settling',next)
  }
  if(event.type==='RELEASE'||event.type==='CANCEL'){
    if(current.hostExecutionId&&!event.hostExecutionId)return result(state,false,'host-execution-required',current)
    return result(removeReservation(state,current.reservationId),true,event.type==='CANCEL'?'cancelled':'released',current)
  }
  return result(state,false,'unknown-event')
}

function lifecycleRunning(state:SchedulerLifecycleState,snapshot:SchedulingSnapshot):SchedulingRunningAllocation[]{
  const existing=new Map(snapshot.capacity.running.map(item=>[item.executionUnitId,item]))
  for(const reservation of state.reservations){
    if(existing.has(reservation.executionUnitId))continue
    existing.set(reservation.executionUnitId,{executionUnitId:reservation.executionUnitId,...reservation.resource})
  }
  return[...existing.values()]
}

export interface SchedulerAdmissionPlan {ok:boolean;reasons:string[];executionUnitIds:string[]}

/**
 * Pure fairness-aware admission selection. Readiness remains graph-derived; lifecycle state
 * contributes only active reservations so pre-dispatch claims consume capacity.
 */
export function planSchedulerAdmissions(snapshot:SchedulingSnapshot,state:SchedulerLifecycleState,limit=Number.POSITIVE_INFINITY):SchedulerAdmissionPlan{
  const validation=validateWorkGraph(snapshot.graph)
  if(!validation.ok)return{ok:false,reasons:validation.reasons,executionUnitIds:[]}
  if(state.missionId!==snapshot.graph.missionId)return{ok:false,reasons:['scheduler-mission-mismatch'],executionUnitIds:[]}
  const reserved=new Set(state.reservations.map(item=>item.executionUnitId)),selected:string[]=[]
  let running=lifecycleRunning(state,snapshot)
  const nodes=new Map(snapshot.graph.nodes.map(node=>[node.id,node]))
  while(selected.length<limit){
    const working:SchedulingSnapshot={...snapshot,capacity:{...snapshot.capacity,running}}
    const decision=planScheduling(working)
    const candidates=decision.units
      .filter(item=>item.disposition==='RUNNABLE'&&!reserved.has(item.executionUnitId)&&!selected.includes(item.executionUnitId))
      .sort((a,b)=>{
        const au=snapshot.graph.executionUnits.find(unit=>unit.id===a.executionUnitId),bu=snapshot.graph.executionUnits.find(unit=>unit.id===b.executionUnitId)
        const an=au?nodes.get(au.workNodeId):undefined,bn=bu?nodes.get(bu.workNodeId):undefined
        return (an?.createdAt??0)-(bn?.createdAt??0)||a.executionUnitId.localeCompare(b.executionUnitId)
      })
    if(!candidates.length)break
    const chosen=candidates[0].executionUnitId
    selected.push(chosen)
    running=[...running,{executionUnitId:chosen,...(snapshot.resolvedResources[chosen]??{})}]
  }
  return{ok:true,reasons:[],executionUnitIds:selected}
}


export function reserveSchedulerUnit(snapshot:SchedulingSnapshot,state:SchedulerLifecycleState,input:{executionUnitId:string;workerId:string;attempt:ExecutionAttemptIdentity;at:number}):SchedulerLifecycleResult{
  const existing=state.reservations.find(item=>item.executionUnitId===input.executionUnitId)
  if(existing&&sameExecutionAttempt(existing.attempt,input.attempt))return result(clone(state),true,'already-reserved',clone(existing))
  const plan=planSchedulerAdmissions(snapshot,state)
  if(!plan.ok)return result(clone(state),false,`invalid-snapshot:${plan.reasons.join(',')}`)
  if(!plan.executionUnitIds.includes(input.executionUnitId))return result(clone(state),false,'unit-not-admitted')
  const unit=snapshot.graph.executionUnits.find(item=>item.id===input.executionUnitId)
  if(!unit)return result(clone(state),false,'execution-unit-not-found')
  if(input.attempt.executionUnitId!==unit.id)return result(clone(state),false,'attempt-unit-mismatch')
  return reduceSchedulerLifecycle(state,{type:'RESERVE',missionId:snapshot.graph.missionId,workNodeId:unit.workNodeId,workerId:input.workerId,attempt:input.attempt,resource:snapshot.resolvedResources[input.executionUnitId]??{},at:input.at})
}

export { createSchedulerLifecycleState,schedulerReservationId } from '../../contracts/orchestration-core.js'
