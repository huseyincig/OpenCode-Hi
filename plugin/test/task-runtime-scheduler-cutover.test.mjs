import test from 'node:test'
import assert from 'node:assert/strict'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { createConcurrencyPolicySource } from '../dist/runtime/scheduler/concurrency.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { startAssessedMission } from './helpers/semantic.mjs'
import { resolveHiConfig } from '../dist/config/resolver.js'
import { opencodeChildPort } from './helpers/host-port.mjs'
import { evaluateIdle } from '../dist/runtime/continuation/evaluator.js'

function workerResult(status='DONE'){return{status,summary:'done',changed_files:[],scope_expansions:[],evidence:[],open_issues:[],needs_context:[]}}
function setup({prompt=async()=>{},abort=async()=>({data:true}),withAbort=true,onCreate}={}){
  let seq=0
  const session={create:async()=>{onCreate?.();return{data:{id:`child-${++seq}`}}},promptAsync:prompt,diff:async()=>({data:[]})}
  if(withAbort)session.abort=abort
  const scheduler=createConcurrencyPolicySource(()=>({global:2,providers:{p:2},models:{'p/code':2}}))
  const runtime=new TaskRuntime(opencodeChildPort({session}),new BackgroundRegistry(),scheduler,process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[{id:'p/code',provider:'p',quality:8,cost:1,tags:['coding','balanced']}],()=>({}))
  const m=startAssessedMission(new MissionStore(),'cutover-parent','implement bounded change',{task_kind:'implementation',scope:'local',required_capabilities:['implementation'],likely_verification:[]})
  return{runtime,scheduler,m}
}

test('TaskRuntime reserves before host spawn, binds host identity, and releases on result',async()=>{
  let mRef
  const setupResult=setup({onCreate:()=>{assert.equal(mRef.execution.scheduler.reservations.length,1);assert.equal(mRef.execution.scheduler.reservations[0].phase,'RESERVED');assert.equal(mRef.execution.scheduler.reservations[0].hostExecutionId,undefined)}})
  const {runtime,m,scheduler}=setupResult;mRef=m
  const started=await runtime.start(m,{objective:'change x',role:'coder',category:'standard',scope:['src/x.ts']})
  assert.equal(started.readiness,'READY');assert.equal(m.execution.scheduler.reservations.length,1);assert.equal(m.execution.scheduler.reservations[0].phase,'RUNNING');assert.equal(m.execution.scheduler.reservations[0].hostExecutionId,started.session_id)
  runtime.applyResult(m,started.worker_id,workerResult())
  assert.equal(m.execution.scheduler.reservations.length,0);assert.equal(m.execution.tasks.find(t=>t.id===started.task_id)?.status,'completed')
})

test('TaskRuntime rejects stale attempt settlement before result/evidence mutation',async()=>{
  const {runtime,m}=setup();const started=await runtime.start(m,{objective:'change x',role:'coder',category:'standard',scope:['src/x.ts']})
  const worker=m.execution.workers.find(w=>w.id===started.worker_id),task=m.execution.tasks.find(t=>t.id===started.task_id);worker.attempt+=1
  runtime.applyResult(m,worker.id,workerResult())
  assert.equal(task.status,'running');assert.equal(m.execution.scheduler.reservations.length,1);assert.ok(m.execution.ledger.some(e=>e.type==='worker.result.scheduler-fence-rejected'))
})

test('TaskRuntime cancellation releases the exact scheduler reservation only after host abort',async()=>{
  let aborted=0;const {runtime,m,scheduler}=setup({abort:async()=>{aborted++;return{data:true}}});const started=await runtime.start(m,{objective:'change x',role:'coder',category:'standard',scope:['src/x.ts']})
  assert.equal(await runtime.cancel(m,started.worker_id),true);assert.equal(aborted,1);assert.equal(m.execution.scheduler.reservations.length,0)
})

test('TaskRuntime unavailable abort during cancellation is terminal instead of permanent worker WAIT',async()=>{
  const {runtime,m,scheduler}=setup({withAbort:false});const started=await runtime.start(m,{objective:'change x',role:'coder',category:'standard',scope:['src/x.ts']})
  assert.equal(await runtime.cancel(m,started.worker_id),false);assert.equal(m.execution.scheduler.reservations.length,1)
  const decision=evaluateIdle(m);assert.equal(decision.decision,'USER_ACTION_REQUIRED');assert.equal(decision.reason,'capability-unavailable:session-abort')
})

test('semantic quarantine with unavailable abort is terminal instead of hiding behind busy worker WAIT',async()=>{
  const {runtime,m}=setup({withAbort:false});await runtime.start(m,{objective:'change x',role:'coder',category:'standard',scope:['src/x.ts']})
  m.identity.semantic_assessment={status:'pending',phase:'followup',revision:m.identity.semantic_assessment.revision+1,source:'host-primary',pending_text:'constraint'}
  assert.equal(await runtime.pauseForSemanticAssessment(m),0);assert.ok(m.execution.blockers.includes('capability-unavailable:session-abort'))
  const decision=evaluateIdle(m);assert.equal(decision.decision,'USER_ACTION_REQUIRED');assert.equal(decision.reason_code,'capability-unavailable')
})

test('TaskRuntime retains host-bound reservation when prompt failure cannot verify abort',async()=>{
  const {runtime,m,scheduler}=setup({prompt:async()=>{throw new Error('prompt transport failed')},withAbort:false})
  await assert.rejects(()=>runtime.start(m,{objective:'change x',role:'coder',category:'standard',scope:['src/x.ts']}),/reservation retained because host abort could not be verified/i)
  assert.equal(m.execution.scheduler.reservations.length,1);assert.equal(m.execution.scheduler.reservations[0].phase,'RUNNING');assert.ok(m.execution.ledger.some(e=>e.type==='worker.start.abort-blocked'))
  const decision=evaluateIdle(m);assert.equal(decision.decision,'USER_ACTION_REQUIRED');assert.equal(decision.reason_code,'capability-unavailable');assert.equal(decision.reason,'capability-unavailable:session-abort')
})


test('semantic quarantine releases the active reservation and resume creates the next exact attempt',async()=>{
  let aborts=0
  const {runtime,m}=setup({abort:async()=>{aborts++;return{data:true}}})
  const started=await runtime.start(m,{objective:'change x',role:'coder',category:'standard',scope:['src/x.ts']})
  const worker=m.execution.workers.find(w=>w.id===started.worker_id)
  assert.equal(worker.attempt,1);assert.equal(m.execution.scheduler.reservations[0].attempt.ordinal,1)
  m.identity.semantic_assessment={status:'pending',phase:'followup',revision:m.identity.semantic_assessment.revision+1,source:'host-primary',pending_text:'constraint'}
  const paused=await runtime.pauseForSemanticAssessment(m);assert.equal(paused,1);assert.equal(aborts,1);assert.equal(worker.status,'ready');assert.equal(m.execution.scheduler.reservations.length,0)
  m.identity.semantic_assessment={...m.identity.semantic_assessment,status:'assessed',assessed_at:Date.now()}
  const resumed=await runtime.resumeAfterSemanticAssessment(m,'constraint');assert.equal(resumed,1);assert.equal(worker.status,'busy');assert.equal(worker.attempt,2);assert.equal(m.execution.scheduler.reservations.length,1);assert.equal(m.execution.scheduler.reservations[0].attempt.ordinal,2);assert.equal(m.execution.scheduler.reservations[0].hostExecutionId,started.session_id)
})

test('corrective same-session resume is scheduler-reserved as the next attempt',async()=>{
  const {runtime,m}=setup();const started=await runtime.start(m,{objective:'change x',role:'coder',category:'standard',scope:['src/x.ts']})
  runtime.applyResult(m,started.worker_id,workerResult('FIX_REQUIRED'))
  const worker=m.execution.workers.find(w=>w.id===started.worker_id),task=m.execution.tasks.find(t=>t.id===started.task_id)
  assert.equal(worker.status,'ready');assert.equal(task.status,'waiting');assert.equal(m.execution.scheduler.reservations.length,0)
  const resumed=await runtime.start(m,{objective:'change x',role:'coder',category:'standard',scope:['src/x.ts']})
  assert.equal(resumed.worker_id,worker.id);assert.equal(worker.attempt,2);assert.equal(m.execution.scheduler.reservations.length,1);assert.equal(m.execution.scheduler.reservations[0].attempt.ordinal,2);assert.equal(m.execution.scheduler.reservations[0].phase,'RUNNING')
})


test('same-session newer attempt settles byte-identical current-attempt result independently of prior-attempt content',async()=>{
  const {runtime,m}=setup();const started=await runtime.start(m,{objective:'change x',role:'coder',category:'standard',scope:['src/x.ts']})
  const prior=workerResult('FIX_REQUIRED');runtime.applyResult(m,started.worker_id,prior)
  const worker=m.execution.workers.find(w=>w.id===started.worker_id),task=m.execution.tasks.find(t=>t.id===started.task_id)
  const attempt1Digest=worker.last_result_digest;assert.ok(attempt1Digest)
  await runtime.resume(m,task.id);assert.equal(worker.attempt,2);assert.equal(worker.last_result_digest,undefined);assert.equal(m.execution.scheduler.reservations[0].phase,'RUNNING')
  runtime.applyResult(m,worker.id,prior)
  assert.equal(worker.status,'ready');assert.equal(task.status,'waiting');assert.equal(task.result.status,'FIX_REQUIRED')
  assert.equal(m.execution.scheduler.reservations.length,0,'current attempt must settle even when normalized result bytes equal the prior attempt')
  assert.equal(worker.last_result_digest,attempt1Digest)
  assert.equal(m.execution.ledger.filter(e=>e.type==='worker.result.duplicate-ignored'&&e.payload?.attempt===2).length,0)
})

test('same-session attempt prompt IDs bind OpenCode assistant ancestry and stale prior result/error cannot settle the newer attempt',async()=>{
  const prompts=[]
  const {runtime,m}=setup({prompt:async req=>{prompts.push(req);return{data:{}}}})
  const started=await runtime.start(m,{objective:'change x',role:'coder',category:'standard',scope:['src/x.ts']})
  const worker=m.execution.workers.find(w=>w.id===started.worker_id),task=m.execution.tasks.find(t=>t.id===started.task_id)
  const attempt1=worker.attempt_prompt_message_id
  assert.match(attempt1,/^msg_[0-9a-f]{26}$/i);assert.equal(prompts[0].body.messageID,attempt1)

  m.identity.semantic_assessment={status:'pending',phase:'followup',revision:m.identity.semantic_assessment.revision+1,source:'host-primary',pending_text:'constraint'}
  assert.equal(await runtime.pauseForSemanticAssessment(m),1)
  m.identity.semantic_assessment={...m.identity.semantic_assessment,status:'assessed',assessed_at:Date.now()}
  assert.equal(await runtime.resumeAfterSemanticAssessment(m,'constraint'),1)
  const attempt2=worker.attempt_prompt_message_id
  assert.match(attempt2,/^msg_[0-9a-f]{26}$/i);assert.notEqual(attempt2,attempt1);assert.equal(prompts[1].body.messageID,attempt2);assert.equal(worker.attempt,2)

  const staleResult={text:JSON.stringify(workerResult('FIX_REQUIRED')),model:{model:'p/code',message_id:'msg_old_assistant',parent_id:attempt1,created_at:worker.started_at}}
  const stale=await runtime.settleHostIdleAssistantResult(m,worker,staleResult)
  assert.equal(stale.applied,false);assert.equal(stale.reason,'assistant-result-stale-attempt-message')
  assert.equal(worker.status,'busy');assert.equal(task.status,'running');assert.equal(m.execution.scheduler.reservations[0].phase,'RUNNING')

  const staleError={text:'',model:{model:'p/code',message_id:'msg_old_error',parent_id:attempt1,created_at:worker.started_at},error:{name:'APIError',message:'old attempt failed',isRetryable:false}}
  const rejectedError=await runtime.settleHostIdleAssistantResult(m,worker,staleError)
  assert.equal(rejectedError.applied,false);assert.equal(rejectedError.reason,'assistant-result-stale-attempt-message');assert.equal(worker.last_runtime_failure_kind,undefined)
  assert.equal(m.execution.scheduler.reservations[0].phase,'RUNNING')

  const current={text:JSON.stringify(workerResult('FIX_REQUIRED')),model:{model:'p/code',message_id:'msg_current_assistant',parent_id:attempt2,created_at:(worker.started_at??0)+1}}
  const accepted=await runtime.settleHostIdleAssistantResult(m,worker,current)
  assert.equal(accepted.applied,true);assert.equal(accepted.reason,'assistant-result-applied');assert.equal(accepted.result?.status,'FIX_REQUIRED')
  assert.equal(worker.status,'ready');assert.equal(task.status,'waiting');assert.equal(m.execution.scheduler.reservations.length,0)
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.assistant-result.stale-attempt-message'&&e.payload?.expected_parent_id===attempt2&&e.payload?.parent_id===attempt1))
})

test('cancelling FIX_REQUIRED task retires only its result-owned blockers and releases replacement ownership',async()=>{
  const {runtime,m}=setup();const first=await runtime.start(m,{objective:'change x',role:'coder',category:'standard',scope:['src/x.ts']});const second=await runtime.start(m,{objective:'change y',role:'coder',category:'standard',scope:['src/y.ts']})
  const firstWorker=m.execution.workers.find(w=>w.id===first.worker_id),firstTask=m.execution.tasks.find(t=>t.id===first.task_id),secondWorker=m.execution.workers.find(w=>w.id===second.worker_id)
  runtime.applyResult(m,firstWorker.id,{...workerResult('FIX_REQUIRED'),open_issues:['only-cancelled','shared-blocker']})
  runtime.applyResult(m,secondWorker.id,{...workerResult('FIX_REQUIRED'),open_issues:['shared-blocker']});m.execution.blockers.push('unrelated-blocker')
  assert.equal(await runtime.cancel(m,firstTask.id),true);assert.equal(firstTask.status,'cancelled');assert.equal(firstWorker.status,'cancelled')
  assert.deepEqual(new Set(m.execution.blockers),new Set(['shared-blocker','unrelated-blocker']))
  const cancelled=m.execution.ledger.findLast(e=>e.type==='worker.cancelled'&&e.task_id===firstTask.id);assert.deepEqual(cancelled?.payload?.retired_result_issues,['only-cancelled'])
})

test('assistant creation time is a secondary stale-attempt fence when host ancestry metadata is absent',async()=>{
  const {runtime,m}=setup();const started=await runtime.start(m,{objective:'change x',role:'coder',category:'standard',scope:['src/x.ts']})
  const worker=m.execution.workers.find(w=>w.id===started.worker_id),task=m.execution.tasks.find(t=>t.id===started.task_id)
  const stale={text:JSON.stringify(workerResult('DONE')),model:{model:'p/code',message_id:'msg_time_old',created_at:(worker.started_at??1)-1}}
  const out=await runtime.settleHostIdleAssistantResult(m,worker,stale)
  assert.equal(out.applied,false);assert.equal(out.reason,'assistant-result-stale-attempt-message');assert.equal(worker.status,'busy');assert.equal(task.status,'running');assert.equal(m.execution.scheduler.reservations[0].phase,'RUNNING')
})
