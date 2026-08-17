import type {EvidenceItem,MissionState} from "../mission/types.js"
import {executionAttemptIdentity} from "../../contracts/orchestration-core.js"

export interface EvidenceClaimApplicability{applicable:boolean;reasons:string[]}

export function evidenceProducerAttemptForWorker(m:MissionState,worker:MissionState['execution']['workers'][number]){
  const identity=executionAttemptIdentity({executionUnitId:`eu:${worker.task_id}`,workerId:worker.id,ordinal:worker.attempt??0,generation:worker.generation_at_spawn??m.continuation.generation})
  return{worker_id:worker.id,execution_unit_id:identity.executionUnitId,attempt_id:identity.attemptId,run_id:identity.runId,ordinal:identity.ordinal,generation:identity.generation}
}

function workerSource(e:EvidenceItem):boolean{return String(e.source??"").startsWith("worker:")}
function exactProducer(m:MissionState,e:EvidenceItem):string[]{
  const reasons:string[]=[],p=e.producer_attempt,isWorker=workerSource(e)
  if(isWorker&&(!e.source_session_id||!e.source_state_hash||!/^[a-f0-9]{64}$/i.test(e.source_state_hash)))reasons.push("worker-source-state-unbound")
  if(!p)return isWorker?[...reasons,"worker-attempt-unbound"]:reasons
  if(!e.source_session_id)reasons.push("producer-session-unbound")
  const worker=m.execution.workers.find(w=>w.id===p.worker_id)
  if(!worker)return[...reasons,"producer-worker-missing"]
  if(e.task_id!==worker.task_id)reasons.push("producer-task-mismatch")
  if(e.source_session_id!==worker.session_id)reasons.push("producer-session-mismatch")
  const expected=executionAttemptIdentity({executionUnitId:`eu:${worker.task_id}`,workerId:worker.id,ordinal:worker.attempt??0,generation:worker.generation_at_spawn??m.continuation.generation})
  if(p.execution_unit_id!==expected.executionUnitId||p.attempt_id!==expected.attemptId||p.run_id!==expected.runId||p.ordinal!==expected.ordinal||p.generation!==expected.generation)reasons.push("producer-attempt-mismatch")
  return reasons
}

/** Claim identity only. Freshness/invalidation is evaluated separately. */
export function evidenceClaimApplicability(m:MissionState,e:EvidenceItem,obligationID?:string):EvidenceClaimApplicability{
  const reasons=exactProducer(m,e)
  if(obligationID){
    if(!e.obligation_ids?.includes(obligationID))reasons.push("obligation-mismatch")
    const ownerTasks=m.execution.tasks.filter(t=>t.obligation_ids.includes(obligationID)).map(t=>t.id)
    if(ownerTasks.length&&e.task_id&&!ownerTasks.includes(e.task_id))reasons.push("task-mismatch")
    if(ownerTasks.length&&workerSource(e)&&!e.task_id)reasons.push("task-unbound")
  }
  return{applicable:reasons.length===0,reasons:[...new Set(reasons)]}
}
