import test from 'node:test'
import assert from 'node:assert/strict'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {opencodeChildPort} from './helpers/host-port.mjs'
import {evaluateIdle} from '../dist/runtime/continuation/evaluator.js'
import {recordRecoveryStrategy} from '../dist/runtime/continuation/recovery-governor.js'
import {appendLedger} from '../dist/runtime/ledger/ledger.js'

function setup(promptImpl=async()=>{},withAbort=true,models=[],assistantResultReader){
  const calls=[],aborts=[]
  let seq=0;const session={promptAsync:async arg=>{calls.push(arg);return promptImpl(arg)},create:async()=>({data:{id:`recovery-${++seq}`}}),diff:async()=>({data:[]}),status:async()=>({data:{child1:{type:'busy'}}})};if(withAbort)session.abort=async req=>{aborts.push(req);return{data:true}};const client={session}
  const scheduler=createConcurrencyPolicySource(()=>({global:4,providers:{},models:{}}))
  const activityReader=assistantResultReader===null?undefined:(assistantResultReader??(async()=>({text:''})))
  const runtime=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),scheduler,process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>models,()=>({}),undefined,[],undefined,undefined,undefined,undefined,undefined,activityReader)
  const store=new MissionStore(process.cwd())
  const m=startAssessedMission(store,'parent','opaque provider task')
  m.execution.tasks.push({id:'t1',mission_id:m.identity.mission_id,objective:'fix it',status:'running',role:'coder',category:'standard',scope:['src/a.ts'],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],execution_profile:{role:'coder',category:'standard',model:'p/primary',fallback_models:['p/fallback1','p/fallback2'],fallback_variants:{'p/fallback1':'high','p/fallback2':'medium'},methodologies:[],permission_profile:{skill_tool_enabled:true,skill_permissions:{},external_effects:'parent-only',recursive_task:'deny'},verification_policy:m.execution.verification_policy,max_context_chars:1000,max_handoff_chars:1000,max_result_chars:1000,max_artifacts:4},worker_id:'w1',external_action_requirements:[],created_at:Date.now(),updated_at:Date.now()})
  m.execution.workers.push({id:'w1',task_id:'t1',role:'coder',category:'standard',session_id:'child1',parent_session_id:'parent',parent_mission_id:m.identity.mission_id,model:'p/primary',fallbacks:['p/fallback1','p/fallback2'],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'busy',attempt:0,generation_at_spawn:m.continuation.generation,updated_at:Date.now()})
  return {runtime,m,calls,aborts}
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
  assert.equal(m.execution.scheduler.reservations.length,1)
  assert.equal(m.execution.ledger.some(x=>x.type==='worker.failed'),false)
})


test('behavioral hazard opens one fresh recovery-only model after two same-model corrections without semantic gain',async()=>{
  const models=[{id:'p/recovery',provider:'p',writeCapable:true,tags:['coding','balanced']}]
  const {runtime,m,calls,aborts}=setup(async()=>{},true,models)
  const worker=m.execution.workers[0],task=m.execution.tasks[0]
  worker.status='ready';task.status='waiting';worker.recovery_candidates=['p/recovery'];worker.fallbacks=[]
  recordRecoveryStrategy(m,{level:1,action:'same-worker-resume'},'started',10,{task_id:task.id,worker_id:worker.id,model:'p/primary'})
  recordRecoveryStrategy(m,{level:2,action:'same-worker-resume'},'started',11,{task_id:task.id,worker_id:worker.id,model:'p/primary'})
  m.continuation.stagnation_count=3
  const recovered=await runtime.recoverStagnation(m,3,'model-escalation')
  assert.equal(recovered,true);assert.equal(worker.model,'p/recovery');assert.equal(worker.session_id,'recovery-1');assert.equal(worker.forked_from_session_id,'child1')
  assert.equal(calls.length,1);assert.deepEqual(calls[0].body.model,{providerID:'p',modelID:'recovery'});assert.equal(aborts.length,0,'idle prior child is not destructively replayed or aborted')
  assert.equal(worker.fallbacks.length,0,'recovery-only candidate must not become a normal provider fallback')
  assert.match(worker.fallback_history.at(-1).reason,/two same-model corrections without semantic gain/)
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.behavioral-model-escalation'&&e.payload?.from==='p/primary'&&e.payload?.to==='p/recovery'))
})

test('behavioral model escalation is fail-closed before the hazard threshold',async()=>{
  const models=[{id:'p/recovery',provider:'p',writeCapable:true,tags:['coding']}]
  const {runtime,m,calls}=setup(async()=>{},true,models)
  const worker=m.execution.workers[0],task=m.execution.tasks[0]
  worker.status='ready';task.status='waiting';worker.recovery_candidates=['p/recovery'];worker.fallbacks=[]
  recordRecoveryStrategy(m,{level:1,action:'same-worker-resume'},'started',10,{task_id:task.id,worker_id:worker.id,model:'p/primary'})
  assert.equal(await runtime.recoverStagnation(m,3,'model-escalation'),false);assert.equal(worker.model,'p/primary');assert.equal(calls.length,0)
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.behavioral-model-escalation.rejected'))
})


test('unparseable terminal assistant output stays fail-closed but becomes resumable FIX_REQUIRED for bounded behavioral recovery',async()=>{
  const {runtime,m}=setup()
  const worker=m.execution.workers[0],task=m.execution.tasks[0]
  worker.projected_model='p/primary'
  const settled=await runtime.settleHostIdleAssistantResult(m,worker,{text:'I finished the task successfully but forgot the WorkerResult envelope.',model:{model:'p/primary'}})
  assert.equal(settled.applied,true);assert.equal(settled.result?.status,'FIX_REQUIRED')
  assert.equal(task.status,'waiting');assert.equal(worker.status,'ready')
  assert.ok(task.result.open_issues.includes('Worker did not return parseable structured result'))
  assert.ok(task.result.open_issues.includes('worker-result-contract-invalid'))
  assert.ok(task.result.needs_context.some(x=>x.startsWith('worker-result-contract-retry:')))
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.result-contract-retryable'&&e.worker_id===worker.id))
  assert.equal(m.execution.scheduler.reservations.length,0,'terminal attempt releases execution capacity before same-session corrective resume')
})

test('normal task_id corrective resumes feed the behavioral hazard circuit and third no-gain resume switches to a fresh recovery-only model',async()=>{
  const models=[
    {id:'p/primary',provider:'p',writeCapable:true,tags:['coding','balanced']},
    {id:'p/recovery',provider:'p',writeCapable:true,tags:['coding','balanced']},
  ]
  const {runtime,m,calls}=setup(async()=>{},true,models)
  const worker=m.execution.workers[0],task=m.execution.tasks[0]
  worker.status='ready';task.status='waiting';worker.fallbacks=[];worker.recovery_candidates=['p/recovery'];worker.requested_model=undefined
  task.result={status:'FIX_REQUIRED',summary:'contract correction required',changed_files:[],evidence:[],open_issues:['worker-result-contract-invalid'],needs_context:['return structured WorkerResult']}

  const first=await runtime.resume(m,task.id)
  assert.equal(first.session_id,'child1');assert.equal(first.model,'p/primary');assert.equal(calls.length,1)
  let history=m.continuation.recovery_history?.filter(x=>x.task_id===task.id&&x.worker_id===worker.id&&x.action==='same-worker-resume')??[]
  assert.deepEqual(history.map(x=>x.level),[1])
  runtime.applyResult(m,worker.id,{status:'FIX_REQUIRED',summary:'still invalid',changed_files:[],evidence:[],open_issues:['worker-result-contract-invalid'],needs_context:['return structured WorkerResult']})

  const second=await runtime.resume(m,task.id)
  assert.equal(second.session_id,'child1');assert.equal(second.model,'p/primary');assert.equal(calls.length,2)
  history=m.continuation.recovery_history?.filter(x=>x.task_id===task.id&&x.worker_id===worker.id&&x.action==='same-worker-resume')??[]
  assert.deepEqual(history.map(x=>x.level),[1,2]);assert.equal(history[0].progress_signature,history[1].progress_signature)
  assert.match(JSON.stringify(calls[1]),/materially different corrective hypothesis or action/i)
  runtime.applyResult(m,worker.id,{status:'FIX_REQUIRED',summary:'still invalid after materially different correction',changed_files:[],evidence:[],open_issues:['worker-result-contract-invalid'],needs_context:['return structured WorkerResult']})

  const third=await runtime.resume(m,task.id)
  assert.equal(third.worker_id,worker.id);assert.equal(third.model,'p/recovery');assert.equal(third.session_id,'recovery-1');assert.equal(calls.length,3)
  assert.deepEqual(worker.fallbacks,[]);assert.equal(worker.forked_from_session_id,'child1')
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.behavioral-model-escalation'&&e.payload?.from==='p/primary'&&e.payload?.to==='p/recovery'))
})


test('busy child with three bounded await timeouts and 120s observed wait is host-aborted then escalated to the next recovery-only model',async()=>{
  const models=[{id:'p/recovery',provider:'p',writeCapable:true,tags:['coding','balanced']}]
  const {runtime,m,calls,aborts}=setup(async()=>{},true,models)
  const worker=m.execution.workers[0],task=m.execution.tasks[0]
  worker.attempt=1;worker.recovery_candidates=['p/recovery'];worker.selected_methodologies=['hi-debugging-root-cause'];worker.loaded_methodologies=['hi-debugging-root-cause'];task.execution_profile.tools=['read','skill'];task.execution_profile.methodologies=['hi-debugging-root-cause']
  for(const timeout_ms of [30_000,60_000,60_000])appendLedger(m,'worker.await-timeout',{task_id:task.id,worker_id:worker.id,payload:{session_id:'child1',attempt:1,timeout_ms}})
  const recovered=await runtime.recoverStalledAwaitWorker(m)
  assert.equal(recovered.disposition,'RECOVERED')
  assert.equal(recovered.from_model,'p/primary');assert.equal(recovered.to_model,'p/recovery')
  assert.equal(aborts.length,1,'stale busy ownership must be host-aborted before replacement execution')
  assert.equal(worker.model,'p/recovery');assert.equal(worker.session_id,'recovery-1');assert.equal(worker.forked_from_session_id,'child1');assert.equal(worker.status,'busy');assert.equal(task.status,'running')
  assert.deepEqual(worker.selected_methodologies,['hi-debugging-root-cause'],'same Task keeps methodology ownership across liveness recovery')
  assert.equal(calls.length,1);assert.deepEqual(calls[0].body.model,{providerID:'p',modelID:'recovery'});assert.notEqual(calls[0].body.tools.skill,false)
  assert.match(JSON.stringify(calls[0]),/host-liveness stall/i)
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.busy-stall-recovery'&&e.payload?.from_session==='child1'&&e.payload?.to_session==='recovery-1'))
})


test('busy child watchdog treats meaningful OpenCode assistant progress inside the await window as liveness and does not abort',async()=>{
  const models=[{id:'p/recovery',provider:'p',writeCapable:true,tags:['coding','balanced']}]
  let observedAt=0
  const {runtime,m,calls,aborts}=setup(async()=>{},true,models,async()=>({text:'',activity:{message_id:'msg-progress',observed_at:observedAt,output_tokens:42,reasoning_tokens:7,tool_calls:1,text_chars:18}}))
  const worker=m.execution.workers[0],task=m.execution.tasks[0]
  worker.attempt=1;worker.recovery_candidates=['p/recovery'];worker.started_at=Date.now()-300_000
  const events=[]
  for(const timeout_ms of [60_000,60_000,60_000])events.push(appendLedger(m,'worker.await-timeout',{task_id:task.id,worker_id:worker.id,payload:{session_id:'child1',attempt:1,timeout_ms}}))
  observedAt=events[1].at+1
  const recovered=await runtime.recoverStalledAwaitWorker(m)
  assert.equal(recovered.disposition,'NOOP');assert.equal(recovered.reason,'meaningful-host-progress-observed')
  assert.equal(aborts.length,0,'await timeout count must not abort a child that progressed during the wait window');assert.equal(calls.length,0)
  assert.equal(worker.session_id,'child1');assert.equal(worker.model,'p/primary');assert.equal(task.status,'running')
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.await-progress-observed'&&e.payload?.activity_message_id==='msg-progress'))
})


test('busy child watchdog fails closed when canonical host activity cannot be read',async()=>{
  const models=[{id:'p/recovery',provider:'p',writeCapable:true,tags:['coding']}]
  const {runtime,m,calls,aborts}=setup(async()=>{},true,models,null)
  const worker=m.execution.workers[0],task=m.execution.tasks[0];worker.attempt=1;worker.recovery_candidates=['p/recovery'];worker.started_at=Date.now()-300_000
  for(const timeout_ms of [60_000,60_000,60_000])appendLedger(m,'worker.await-timeout',{task_id:task.id,worker_id:worker.id,payload:{session_id:'child1',attempt:1,timeout_ms}})
  const recovered=await runtime.recoverStalledAwaitWorker(m)
  assert.equal(recovered.disposition,'NOOP');assert.equal(recovered.reason,'host-activity-reader-unavailable');assert.equal(aborts.length,0);assert.equal(calls.length,0);assert.equal(worker.session_id,'child1')
})

test('busy child watchdog fails closed when canonical host activity read errors',async()=>{
  const models=[{id:'p/recovery',provider:'p',writeCapable:true,tags:['coding']}]
  const {runtime,m,calls,aborts}=setup(async()=>{},true,models,async()=>{throw new Error('message surface unavailable')})
  const worker=m.execution.workers[0],task=m.execution.tasks[0];worker.attempt=1;worker.recovery_candidates=['p/recovery'];worker.started_at=Date.now()-300_000
  for(const timeout_ms of [60_000,60_000,60_000])appendLedger(m,'worker.await-timeout',{task_id:task.id,worker_id:worker.id,payload:{session_id:'child1',attempt:1,timeout_ms}})
  const recovered=await runtime.recoverStalledAwaitWorker(m)
  assert.equal(recovered.disposition,'NOOP');assert.equal(recovered.reason,'host-activity-read-failed');assert.equal(aborts.length,0);assert.equal(calls.length,0);assert.equal(worker.session_id,'child1')
})

test('busy child watchdog stays inert below the bounded wait threshold',async()=>{
  const models=[{id:'p/recovery',provider:'p',writeCapable:true,tags:['coding']}]
  const {runtime,m,calls,aborts}=setup(async()=>{},true,models)
  const worker=m.execution.workers[0],task=m.execution.tasks[0];worker.attempt=1;worker.recovery_candidates=['p/recovery']
  for(const timeout_ms of [30_000,60_000])appendLedger(m,'worker.await-timeout',{task_id:task.id,worker_id:worker.id,payload:{session_id:'child1',attempt:1,timeout_ms}})
  const recovered=await runtime.recoverStalledAwaitWorker(m)
  assert.equal(recovered.disposition,'NOOP');assert.equal(calls.length,0);assert.equal(aborts.length,0);assert.equal(worker.session_id,'child1');assert.equal(worker.model,'p/primary')
})


test('busy child threshold with no admissible recovery model aborts stale ownership and becomes canonical BLOCKED',async()=>{
  const {runtime,m,calls,aborts}=setup(async()=>{},true,[])
  const worker=m.execution.workers[0],task=m.execution.tasks[0];worker.attempt=1;worker.recovery_candidates=[]
  for(const timeout_ms of [60_000,60_000,60_000])appendLedger(m,'worker.await-timeout',{task_id:task.id,worker_id:worker.id,payload:{session_id:'child1',attempt:1,timeout_ms}})
  const recovered=await runtime.recoverStalledAwaitWorker(m)
  assert.equal(recovered.disposition,'BLOCKED');assert.equal(recovered.reason,'no-admissible-recovery-model')
  assert.equal(aborts.length,1);assert.equal(calls.length,0);assert.equal(worker.session_id,undefined);assert.equal(worker.status,'ready');assert.equal(task.status,'blocked');assert.equal(task.result.status,'BLOCKED')
  assert.ok(task.result.open_issues.some(x=>x.startsWith('host-liveness-recovery:no-admissible-recovery-model:')))
})
