import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createTask,createWorker,beginWorkerAttempt} from '../dist/runtime/worker/worker-runtime.js'
import {bindWorkerUsageObservation} from '../dist/runtime/economics/usage-runtime.js'
import {missionCausalUsageAttribution} from '../dist/runtime/economics/causal-attribution.js'
import {appendLedger} from '../dist/runtime/ledger/ledger.js'
import {missionMetrics} from '../dist/runtime/ledger/metrics.js'
import {startAssessedMission} from './helpers/semantic.mjs'

function fixture(id='causal'){
  const store=new MissionStore(),m=startAssessedMission(store,id,'implement',{task_kind:'implementation',likely_verification:[]})
  const task=createTask(m,{objective:'x',role:'coder',category:'standard'}),worker=createWorker(m,task,'p/m');worker.session_id='child-1';worker.status='busy'
  return{m,task,worker}
}
const usage=(message_id,input=100,coverage='assistant-step-total')=>({message_id,model_identity:'p/m',token_source:coverage==='assistant-step-total'?'opencode-step-finish':'opencode-assistant-message',coverage,confidence:'exact',step_count:1,tokens:{input,output:20,reasoning:5,cache_read:10,cache_write:2},monetary:{usd:.01,source:'opencode-calculated',confidence:'derived'}})

test('causal attribution separates primary execution from exact corrective and model-escalation repeats',()=>{
  const {m,task,worker}=fixture('causal-core')
  beginWorkerAttempt(task,worker);bindWorkerUsageObservation(m,worker,usage('m1',100))
  beginWorkerAttempt(task,worker);appendLedger(m,'worker.resumed',{task_id:task.id,worker_id:worker.id,payload:{correction_level:1}});bindWorkerUsageObservation(m,worker,usage('m2',80))
  beginWorkerAttempt(task,worker);appendLedger(m,'worker.model-escalated',{task_id:task.id,worker_id:worker.id,payload:{correction_level:3,model:'p/m2'}});bindWorkerUsageObservation(m,worker,usage('m3',70))
  const out=missionCausalUsageAttribution(m)
  assert.deepEqual(out.rows.map(x=>x.cause),['PRIMARY_EXECUTION','CORRECTIVE_RETRY','BEHAVIORAL_MODEL_ESCALATION'])
  assert.equal(out.rows.every(x=>x.lifecycle_attribution==='exact'),true)
  assert.equal(out.repeat_exact_tokens,out.rows[1].total_tokens+out.rows[2].total_tokens)
  assert.equal(out.repeat_exact_context_tokens,out.rows[1].context_tokens+out.rows[2].context_tokens)
  assert.equal(out.unattributed_repeat_exact_tokens,0)
  assert.equal(out.cache_repayment,'unavailable-without-per-turn-prefix-and-ttl-evidence')
  assert.equal(out.routing_authority,false)
})

test('runtime fallback and write-conflict reconciliation remain distinct lifecycle causes',()=>{
  const {m,task,worker}=fixture('causal-runtime')
  beginWorkerAttempt(task,worker);bindWorkerUsageObservation(m,worker,usage('m1'))
  beginWorkerAttempt(task,worker);appendLedger(m,'worker.runtime-fallback',{task_id:task.id,worker_id:worker.id,payload:{from:'p/a',to:'p/b'}});bindWorkerUsageObservation(m,worker,usage('m2'))
  beginWorkerAttempt(task,worker);appendLedger(m,'parallel.write-conflict.resumed',{task_id:task.id,worker_id:worker.id,payload:{after_task:'t_other'}});bindWorkerUsageObservation(m,worker,usage('m3'))
  const out=missionCausalUsageAttribution(m)
  assert.deepEqual(out.rows.map(x=>x.cause),['PRIMARY_EXECUTION','PROVIDER_RUNTIME_FALLBACK','WRITE_CONFLICT_RECONCILIATION'])
  assert.equal(out.by_cause.PROVIDER_RUNTIME_FALLBACK.attempts,1)
  assert.equal(out.by_cause.WRITE_CONFLICT_RECONCILIATION.attempts,1)
})

test('repeat with no exact lifecycle receipt is explicitly unattributed and partial usage is not promoted to exact repeat tokens',()=>{
  const {m,task,worker}=fixture('causal-unknown')
  beginWorkerAttempt(task,worker);bindWorkerUsageObservation(m,worker,usage('m1'))
  beginWorkerAttempt(task,worker);bindWorkerUsageObservation(m,worker,usage('m2',50,'assistant-message-reported'))
  const out=missionCausalUsageAttribution(m),repeat=out.rows[1]
  assert.equal(repeat.cause,'REPEATED_EXECUTION_UNATTRIBUTED');assert.equal(repeat.lifecycle_attribution,'unattributed')
  assert.equal(out.repeat_exact_tokens,0);assert.equal(out.unattributed_repeat_exact_tokens,0);assert.equal(out.partial_observations,1)
})

test('mission metrics expose causal diagnostics without changing monetary provenance or routing authority',()=>{
  const {m,task,worker}=fixture('causal-metrics')
  beginWorkerAttempt(task,worker);bindWorkerUsageObservation(m,worker,usage('m1'))
  beginWorkerAttempt(task,worker);appendLedger(m,'worker.constraint-rebased',{task_id:task.id,worker_id:worker.id,payload:{generation:m.continuation.generation}});bindWorkerUsageObservation(m,worker,usage('m2'))
  const row=missionMetrics(m)
  assert.equal(row.usage.monetary_basis,'opencode-calculated-derived')
  assert.equal(row.usage.causal.rows[1].cause,'CONSTRAINT_REBASE')
  assert.equal(row.usage.causal.routing_authority,false)
})
