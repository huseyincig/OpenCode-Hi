import test from 'node:test'
import assert from 'node:assert/strict'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { ConcurrencyScheduler } from '../dist/runtime/scheduler/concurrency.js'
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
  const scheduler=new ConcurrencyScheduler(()=>({global:2,providers:{p:2},models:{'p/code':2}}))
  const runtime=new TaskRuntime(opencodeChildPort({session}),new BackgroundRegistry(),scheduler,process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[{id:'p/code',provider:'p',quality:8,cost:1,tags:['coding','balanced']}],()=>({}))
  const m=startAssessedMission(new MissionStore(),'cutover-parent','implement bounded change',{task_kind:'implementation',scope:'local',required_capabilities:['implementation'],likely_verification:[]})
  return{runtime,scheduler,m}
}

test('TaskRuntime reserves before host spawn, binds host identity, and releases on result',async()=>{
  let mRef
  const setupResult=setup({onCreate:()=>{assert.equal(mRef.execution.scheduler.reservations.length,1);assert.equal(mRef.execution.scheduler.reservations[0].phase,'RESERVED');assert.equal(mRef.execution.scheduler.reservations[0].hostExecutionId,undefined)}})
  const {runtime,m,scheduler}=setupResult;mRef=m
  const started=await runtime.start(m,{objective:'change x',role:'coder',category:'standard',scope:['src/x.ts']})
  assert.equal(started.readiness,'READY');assert.equal(m.execution.scheduler.reservations.length,1);assert.equal(m.execution.scheduler.reservations[0].phase,'RUNNING');assert.equal(m.execution.scheduler.reservations[0].hostExecutionId,started.session_id);assert.equal(scheduler.running(),1)
  runtime.applyResult(m,started.worker_id,workerResult())
  assert.equal(m.execution.scheduler.reservations.length,0);assert.equal(scheduler.running(),0);assert.equal(m.execution.tasks.find(t=>t.id===started.task_id)?.status,'completed')
})

test('TaskRuntime rejects stale attempt settlement before result/evidence mutation',async()=>{
  const {runtime,m}=setup();const started=await runtime.start(m,{objective:'change x',role:'coder',category:'standard',scope:['src/x.ts']})
  const worker=m.execution.workers.find(w=>w.id===started.worker_id),task=m.execution.tasks.find(t=>t.id===started.task_id);worker.attempt+=1
  runtime.applyResult(m,worker.id,workerResult())
  assert.equal(task.status,'running');assert.equal(m.execution.scheduler.reservations.length,1);assert.ok(m.execution.ledger.some(e=>e.type==='worker.result.scheduler-fence-rejected'))
})

test('TaskRuntime cancellation releases the exact scheduler reservation only after host abort',async()=>{
  let aborted=0;const {runtime,m,scheduler}=setup({abort:async()=>{aborted++;return{data:true}}});const started=await runtime.start(m,{objective:'change x',role:'coder',category:'standard',scope:['src/x.ts']})
  assert.equal(await runtime.cancel(m,started.worker_id),true);assert.equal(aborted,1);assert.equal(m.execution.scheduler.reservations.length,0);assert.equal(scheduler.running(),0)
})

test('TaskRuntime unavailable abort during cancellation is terminal instead of permanent worker WAIT',async()=>{
  const {runtime,m,scheduler}=setup({withAbort:false});const started=await runtime.start(m,{objective:'change x',role:'coder',category:'standard',scope:['src/x.ts']})
  assert.equal(await runtime.cancel(m,started.worker_id),false);assert.equal(m.execution.scheduler.reservations.length,1);assert.equal(scheduler.running(),1)
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
  assert.equal(m.execution.scheduler.reservations.length,1);assert.equal(m.execution.scheduler.reservations[0].phase,'RUNNING');assert.equal(scheduler.running(),1);assert.ok(m.execution.ledger.some(e=>e.type==='worker.start.abort-blocked'))
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
