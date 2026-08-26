import type {MissionState} from '../mission/types.js'
import {appendLedger} from '../ledger/ledger.js'
import {syncMissionGates} from '../gates/gates.js'
import {addEvidence} from '../evidence/evidence-runtime.js'
import type {TaskPreconditionResult} from './preconditions.js'
import type {WorkerEvidenceKind} from '../../contracts/evidence-kinds.js'

const TERMINAL_STATIC_PRECONDITIONS=new Set([
  'native-child-session','native-child-prompt','runtime-model','methodology-resource',
  'agent-definition','agent-mode','tool-read','tool-edit','recursive-delegation',
])
const CAPABILITY_PREFIXES=['capability-precondition:','capability-unavailable:'] as const

export function isTerminalCapabilityPrecondition(id:string):boolean{return TERMINAL_STATIC_PRECONDITIONS.has(id)}
export function isCapabilityBlocker(value:string):boolean{return CAPABILITY_PREFIXES.some(prefix=>value.startsWith(prefix))}
export function firstCapabilityBlocker(m:MissionState):string|undefined{return m.execution.blockers.find(isCapabilityBlocker)}

/**
 * Bind static host/runtime preflight failures into durable mission state. The markers are scoped by
 * role and reconciled on every new preflight for that same role, so a real config/provider/resource
 * change clears the old marker instead of requiring manual state surgery.
 */
export function reconcileTaskCapabilityPreconditions(m:MissionState,role:string,result:TaskPreconditionResult):string[]{
  const prefix=`capability-precondition:${role}:`,current=result.items.filter(item=>item.decision==='RESOLVE'&&isTerminalCapabilityPrecondition(item.id)).map(item=>`${prefix}${item.id}`)
  const before=new Set(m.execution.blockers),keep=m.execution.blockers.filter(item=>!item.startsWith(prefix)||current.includes(item))
  m.execution.blockers=[...new Set([...keep,...current])]
  const after=new Set(m.execution.blockers),added=[...after].filter(x=>!before.has(x)&&x.startsWith(prefix)),cleared=[...before].filter(x=>!after.has(x)&&x.startsWith(prefix))
  if(added.length||cleared.length)appendLedger(m,'capability.precondition-reconciled',{payload:{role,added,cleared,preconditions:result.items.filter(x=>x.decision!=='READY').map(x=>({id:x.id,decision:x.decision,reason:x.reason})).slice(0,16)}})
  syncMissionGates(m)
  return current
}

export function markCapabilityUnavailable(m:MissionState,input:{capability:string;reason:string;taskId?:string;workerId?:string}):string{
  const capability=input.capability.trim().toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'unknown',marker=`capability-unavailable:${capability}`
  if(!m.execution.blockers.includes(marker)){
    m.execution.blockers.push(marker)
    appendLedger(m,'capability.unavailable',{task_id:input.taskId,worker_id:input.workerId,payload:{capability,reason:input.reason.slice(0,600),marker}})
  }
  syncMissionGates(m)
  return marker
}

export function markVerificationCapabilityUnavailable(m:MissionState,input:{capability:string;reason:string;requiredKinds:WorkerEvidenceKind[];obligationIds:string[];taskId?:string;workerId?:string}):string{
  const marker=markCapabilityUnavailable(m,input),verificationObligations=new Set(m.execution.obligations.filter(o=>o.kind==='verification').map(o=>o.id)),obligationIds=[...new Set(input.obligationIds.filter(id=>verificationObligations.has(id)))]
  for(const kind of [...new Set(input.requiredKinds)]){
    const duplicate=m.execution.evidence.items.some(e=>!e.invalidated_at&&e.kind===kind&&e.outcome==='environment-issue'&&e.reason===marker&&obligationIds.every(id=>(e.obligation_ids??[]).includes(id)))
    if(!duplicate)addEvidence(m,{kind,summary:`Required verification capability unavailable: ${input.capability}`.slice(0,1000),scope:[...new Set(m.vcs.changed_files)],source:'runtime:capability-preflight',task_id:input.taskId,obligation_ids:obligationIds,outcome:'environment-issue',reason:marker})
  }
  return marker
}

export function clearCapabilityUnavailable(m:MissionState,capability:string):boolean{
  const key=capability.trim().toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'unknown',marker=`capability-unavailable:${key}`,before=m.execution.blockers.length
  m.execution.blockers=m.execution.blockers.filter(x=>x!==marker)
  if(m.execution.blockers.length!==before){appendLedger(m,'capability.available',{payload:{capability:key,marker}});syncMissionGates(m);return true}
  return false
}
