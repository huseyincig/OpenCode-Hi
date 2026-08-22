import test from 'node:test'
import assert from 'node:assert/strict'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {opencodeChildPort} from './helpers/host-port.mjs'
import {evaluateIdle} from '../dist/runtime/continuation/evaluator.js'

function setup(promptImpl=async()=>{},withAbort=true){
  const calls=[],aborts=[]
  let seq=0;const session={promptAsync:async arg=>{calls.push(arg);return promptImpl(arg)},create:async()=>({data:{id:`recovery-${++seq}`}}),diff:async()=>({data:[]})};if(withAbort)session.abort=async req=>{aborts.push(req);return{data:true}};const client={session}
  const scheduler=new ConcurrencyScheduler(()=>({global:4,providers:{},models:{}}))
  const runtime=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),scheduler,process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
  const store=new MissionStore(process.cwd())
  const m=startAssessedMission(store,'parent','opaque provider task')
  m.execution.tasks.push({id:'t1',mission_id:m.identity.mission_id,objective:'fix it',status:'running',role:'coder',category:'standard',scope:['src/a.ts'],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],execution_profile:{role:'coder',category:'standard',model:'p/primary',fallback_models:['p/fallback1','p/fallback2'],fallback_variants:{'p/fallback1':'high','p/fallback2':'medium'},methodologies:[],permission_profile:{skill_tool_enabled:true,skill_permissions:{},external_effects:'parent-only',recursive_task:'deny'},verification_policy:m.execution.verification_policy,max_context_chars:1000,max_handoff_chars:1000,max_result_chars:1000,max_artifacts:4},worker_id:'w1',external_action_requirements:[],created_at:Date.now(),updated_at:Date.now()})
  m.execution.workers.push({id:'w1',task_id:'t1',role:'coder',category:'standard',session_id:'child1',parent_session_id:'parent',parent_mission_id:m.identity.mission_id,model:'p/primary',fallbacks:['p/fallback1','p/fallback2'],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'busy',attempt:0,generation_at_spawn:m.continuation.generation,updated_at:Date.now()})
  scheduler.acquire('w1','p','p/primary')
  return {runtime,scheduler,m,calls,aborts}
}

test('provider failure creates a fresh child on first fallback without stagnation',async()=>{
  const {runtime,m,calls}=setup()
  m.continuation.stagnation_count=4
  const settled=await runtime.settleHostIdleRuntimeError(m,m.execution.workers[0],{name:'APIError',message:'429 upstream rate limit',isRetryable:true,statusCode:429})
  assert.equal(settled.wakeResult,'RUNTIME_FALLBACK')
  const w=m.execution.workers[0]
  assert.equal(w.session_id,'recovery-1')
  assert.equal(w.model,'p/fallback1')
  assert.equal(w.runtime_recovery_pending,true)
  assert.equal(w.runtime_recovery_attempt,1)
  assert.equal(w.attempt,1)
  assert.equal(calls.length,1)
  assert.deepEqual(calls[0].body.model,{providerID:'p',modelID:'fallback1'})
  assert.equal(m.continuation.stagnation_count,4,'provider failure does not increment reasoning stagnation')
})

test('second provider failure advances to next fallback rather than returning to prior model',async()=>{
  const {runtime,m,calls}=setup()
  assert.equal((await runtime.settleHostIdleRuntimeError(m,m.execution.workers[0],{name:'APIError',message:'503 provider unavailable',isRetryable:true,statusCode:503})).wakeResult,'RUNTIME_FALLBACK')
  m.execution.workers[0].runtime_recovery_pending=false
  assert.equal((await runtime.settleHostIdleRuntimeError(m,m.execution.workers[0],{name:'APIError',message:'network_error',isRetryable:true})).wakeResult,'RUNTIME_FALLBACK')
  assert.equal(m.execution.workers[0].model,'p/fallback2')
  assert.equal(m.execution.workers[0].session_id,'recovery-2')
  assert.equal(m.execution.workers[0].runtime_recovery_attempt,2)
  assert.equal(m.execution.workers[0].attempt,2)
  assert.deepEqual(calls.map(x=>x.body.model.modelID),['fallback1','fallback2'])
})

test('host-terminal fallback never requires or emits a redundant abort mutation',async()=>{
  const {runtime,m,calls,aborts}=setup(async()=>{},false)
  const settled=await runtime.settleHostIdleRuntimeError(m,m.execution.workers[0],{name:'APIError',message:'429 upstream rate limit',isRetryable:true,statusCode:429})
  assert.equal(settled.wakeResult,'RUNTIME_FALLBACK')
  assert.equal(m.execution.workers[0].session_id,'recovery-1')
  assert.equal(calls.length,1);assert.equal(aborts.length,0)
  assert.ok(m.execution.ledger.some(x=>x.type==='worker.runtime-fallback.host-terminal-confirmed'&&x.payload?.action==='release-without-abort'))
})

test('exhausted fallback chain becomes provider-failure blocker and resets stagnation',async()=>{
  const {runtime,m}=setup()
  m.execution.workers[0].model='p/fallback2'
  m.execution.workers[0].fallbacks=[]
  m.continuation.stagnation_count=5
  const settled=await runtime.settleHostIdleRuntimeError(m,m.execution.workers[0],{name:'APIError',message:'429 quota exceeded',isRetryable:true,statusCode:429})
  assert.equal(settled.wakeResult,'BLOCKED')
  assert.equal(m.execution.workers[0].runtime_fallback_exhausted,true)
  assert.equal(m.continuation.stagnation_count,0)
  assert.equal(m.execution.tasks[0].status,'blocked')
  assert.match(m.execution.tasks[0].result.open_issues[0],/^provider-failure:provider-transport:/)
  assert.ok(m.execution.blockers.some(x=>x.startsWith('provider-failure:provider-transport:')))
})


test('host-idle-confirmed provider failure starts fallback without redundantly aborting the terminal session',async()=>{
  const {runtime,m,calls,aborts}=setup()
  const worker=m.execution.workers[0]
  const settled=await runtime.settleHostIdleRuntimeError(m,worker,{name:'APIError',message:'429 upstream rate limit',isRetryable:true,statusCode:429})
  assert.equal(settled.applied,true);assert.equal(settled.wakeResult,'RUNTIME_FALLBACK');assert.equal(aborts.length,0)
  assert.equal(worker.session_id,'recovery-1');assert.equal(worker.model,'p/fallback1');assert.equal(calls.length,1)
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.runtime-fallback.host-terminal-confirmed'&&e.payload?.session_id==='child1'&&e.payload?.action==='release-without-abort'))
})


test('nonretryable terminal OpenCode APIError becomes a provider blocker without fallback or reasoning recovery',async()=>{
  const {runtime,m,calls,aborts}=setup()
  m.continuation.stagnation_count=3
  const worker=m.execution.workers[0]
  const settled=await runtime.settleHostIdleRuntimeError(m,worker,{name:'APIError',message:'invalid request',isRetryable:false,statusCode:400})
  assert.equal(settled.applied,true);assert.equal(settled.wakeResult,'FAILED');assert.equal(calls.length,0);assert.equal(aborts.length,0)
  assert.equal(worker.last_runtime_failure_kind,'provider-transport');assert.equal(worker.status,'failed');assert.equal(m.continuation.stagnation_count,0)
  assert.equal(m.execution.tasks[0].status,'failed');assert.match(m.execution.tasks[0].result.open_issues[0],/^provider-failure:provider-transport:/)
  const decision=evaluateIdle(m);assert.equal(decision.decision,'USER_ACTION_REQUIRED');assert.equal(decision.reason_code,'provider-failure-blocked')
})


test('terminal ContextOverflowError never guesses that a configured fallback has larger context capacity',async()=>{
  const {runtime,m,calls,aborts}=setup()
  m.continuation.stagnation_count=4
  const worker=m.execution.workers[0]
  const settled=await runtime.settleHostIdleRuntimeError(m,worker,{name:'ContextOverflowError',message:'maximum context length exceeded'})
  assert.equal(settled.applied,true);assert.equal(settled.wakeResult,'FAILED');assert.equal(calls.length,0);assert.equal(aborts.length,0)
  assert.equal(worker.last_runtime_failure_kind,'context-overflow');assert.equal(worker.model,'p/primary');assert.equal(m.continuation.stagnation_count,0)
  assert.match(m.execution.tasks[0].result.open_issues[0],/^capability-unavailable:context-capacity:/)
  assert.match(m.execution.tasks[0].result.needs_context[0],/compaction.*exhausted|could not resolve terminal context capacity/i)
  const decision=evaluateIdle(m);assert.equal(decision.decision,'USER_ACTION_REQUIRED');assert.equal(decision.reason_code,'capability-unavailable')
})

test('terminal generic tool incompatibility does not switch models without proven tool capability',async()=>{
  const {runtime,m,calls,aborts}=setup()
  m.continuation.stagnation_count=4
  const worker=m.execution.workers[0]
  const settled=await runtime.settleHostIdleRuntimeError(m,worker,{message:'tool unsupported for selected model'})
  assert.equal(settled.applied,true);assert.equal(settled.wakeResult,'FAILED');assert.equal(calls.length,0);assert.equal(aborts.length,0)
  assert.equal(worker.last_runtime_failure_kind,'tool-incompatibility');assert.equal(worker.model,'p/primary');assert.equal(m.continuation.stagnation_count,0)
  assert.match(m.execution.tasks[0].result.open_issues[0],/^capability-unavailable:tool-compatibility:/)
  assert.match(m.execution.tasks[0].result.needs_context[0],/proven required tool capability/i)
  const decision=evaluateIdle(m);assert.equal(decision.decision,'USER_ACTION_REQUIRED');assert.equal(decision.reason_code,'capability-unavailable')
})


test('uncertain fallback dispatch preserves active ownership',async()=>{
  const {runtime,m,calls,scheduler}=setup(async()=>{throw new TypeError('uncertain transport acknowledgement')},false)
  const settled=await runtime.settleHostIdleRuntimeError(m,m.execution.workers[0],{name:'APIError',message:'503 provider unavailable',isRetryable:true,statusCode:503})
  const worker=m.execution.workers[0],task=m.execution.tasks[0]
  assert.equal(settled.wakeResult,'QUARANTINED')
  assert.equal(calls.length,1)
  assert.equal(worker.status,'busy');assert.equal(task.status,'running')
  assert.equal(worker.session_id,'recovery-1')
  assert.equal(scheduler.running(),1)
  assert.equal(m.execution.scheduler.reservations.length,1)
  assert.equal(m.execution.ledger.some(x=>x.type==='worker.failed'),false)
})
