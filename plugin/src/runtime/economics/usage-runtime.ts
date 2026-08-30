import type {ExecutionUsageObservation,HostUsageObservation} from '../../contracts/execution-usage.js'
import {executionUsageObservationId} from '../../contracts/execution-usage.js'
import type {MissionState,WorkerState} from '../mission/types.js'
import {appendLedger} from '../ledger/ledger.js'

export function bindWorkerUsageObservation(m:MissionState,worker:WorkerState,usage:HostUsageObservation,at=Date.now()):ExecutionUsageObservation|undefined{
  if(!worker.session_id||worker.attempt<1)return undefined
  const execution_unit_id=`eu:${worker.task_id}`,generation=worker.generation_at_spawn??m.continuation.generation,source_session_id=worker.session_id
  const observation_id=executionUsageObservationId({workerId:worker.id,executionUnitId:execution_unit_id,attemptOrdinal:worker.attempt,generation,sessionId:source_session_id,messageId:usage.message_id})
  if((worker.usage_observations??[]).some(item=>item.observation_id===observation_id))return worker.usage_observations!.find(item=>item.observation_id===observation_id)
  const observation:ExecutionUsageObservation={...usage,observation_id,worker_id:worker.id,execution_unit_id,attempt_ordinal:worker.attempt,generation,source_session_id,observed_at:usage.observed_at??at}
  worker.usage_observations=[...(worker.usage_observations??[]),observation]
  appendLedger(m,'worker.usage-observed',{task_id:worker.task_id,worker_id:worker.id,payload:{observation_id,attempt:worker.attempt,generation,token_source:observation.token_source,coverage:observation.coverage,steps:observation.step_count,tokens:observation.tokens,monetary:observation.monetary,model_identity:observation.model_identity}})
  return observation
}

export function workerExactTokenUsage(worker:WorkerState){
  const complete=(worker.usage_observations??[]).filter(item=>item.coverage==='assistant-step-total')
  return complete.reduce((sum,item)=>({input:sum.input+item.tokens.input,output:sum.output+item.tokens.output,reasoning:sum.reasoning+item.tokens.reasoning,cache_read:sum.cache_read+item.tokens.cache_read,cache_write:sum.cache_write+item.tokens.cache_write}),{input:0,output:0,reasoning:0,cache_read:0,cache_write:0})
}
export function workerDerivedOpenCodeCost(worker:WorkerState):number{return(worker.usage_observations??[]).reduce((sum,item)=>sum+(item.monetary?.source==='opencode-calculated'?item.monetary.usd:0),0)}
