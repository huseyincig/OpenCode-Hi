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

function setup(promptImpl=async()=>{},withAbort=true,models=[],assistantResultReader,hostStatus='busy'){
  const calls=[],aborts=[]
  let seq=0;const session={promptAsync:async arg=>{calls.push(arg);return promptImpl(arg)},create:async()=>({data:{id:`recovery-${++seq}`}}),diff:async()=>({data:[]}),status:async()=>({data:{child1:{type:hostStatus}}})};if(withAbort)session.abort=async req=>{aborts.push(req);return{data:true}};const client={session}
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
  assert.deepEqual(calls[0].body.model,{providerID:'p',modelID:'fallback1'});assert.equal(calls[0].body.format.type,'json_schema');assert.equal(calls[0].body.format.retryCount,0);assert.ok(calls[0].body.format.schema.required.includes('evidence'))
  assert.equal(m.continuation.stagnation_count,4,'provider failure does not increment reasoning stagnation')
})

test('fresh provider fallback preserves exact visual verification case and full evidence-ref result contract',async()=>{
  const models=[{id:'p/fallback1',provider:'p',writeCapable:true,visionCapable:true,tags:['coding','balanced','vision']},{id:'p/fallback2',provider:'p',writeCapable:true,visionCapable:true,tags:['coding','balanced','vision']}]
  const {runtime,m,calls}=setup(async()=>{},true,models)
  const task=m.execution.tasks[0],worker=m.execution.workers[0]
  task.role='visual-qa';task.category='visual';worker.role='visual-qa';worker.category='visual';worker.selected_methodologies=['hi-visual-qa'];worker.loaded_methodologies=['hi-visual-qa'];worker.methodologies=[{name:'hi-visual-qa',permission:'allow'}]
  task.verification_cases=[{id:'vc_desktop-layout',subject:'desktop cards align',required_browser_actions:['viewport','screenshot','inspect']},{id:'vc_theme-persistence',subject:'theme survives reload',required_browser_actions:['click','navigate','inspect']}]
  task.execution_profile={...task.execution_profile,role:'visual-qa',category:'visual',methodologies:['hi-visual-qa'],task:{objective:task.objective,scope:[...task.scope],dependencies:[],required_evidence:['visual-check'],verification_cases:structuredClone(task.verification_cases)},browser_backend:'bounded-playwright',browser_allowed_origins:['http://127.0.0.1:8085'],browser_required_origins:['http://127.0.0.1:8085']}
  const settled=await runtime.settleHostIdleRuntimeError(m,worker,{name:'APIError',message:'503 provider unavailable',isRetryable:true,statusCode:503})
  assert.equal(settled.wakeResult,'RUNTIME_FALLBACK');assert.equal(calls.length,1)
  const prompt=JSON.stringify(calls[0])
  assert.match(prompt,/verification_coverage/);assert.match(prompt,/FULL_EVIDENCE_REF/);assert.match(prompt,/ENTIRE current-attempt evidence_ref string/);assert.match(prompt,/vc_desktop-layout/);assert.match(prompt,/vc_theme-persistence/);assert.match(prompt,/viewport\+screenshot\+inspect/);assert.match(prompt,/click\+navigate\+inspect/);assert.match(prompt,/prefix ev_ab12cd34 is invalid/);assert.match(prompt,/Do not substitute observation_id or screenshot_artifact_ref/)
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


test('automatic selection uses bounded recovery-only candidate after native provider retries become terminal',async()=>{
  const models=[{id:'p/recovery',provider:'p',writeCapable:true,tags:['coding','balanced']}]
  const {runtime,m,calls}=setup(async()=>{},true,models)
  const worker=m.execution.workers[0];worker.fallbacks=[];worker.recovery_candidates=['p/recovery'];worker.model_selection_reason=['standard capability recommendation','ephemeral automatic selection'];worker.requested_model=undefined
  m.execution.tasks[0].execution_profile.fallback_models=[];m.execution.tasks[0].execution_profile.fallback_variants={'p/recovery':'high'}
  const settled=await runtime.settleHostIdleRuntimeError(m,worker,{name:'APIError',message:'503 Endpoint is unavailable',isRetryable:true,statusCode:503})
  assert.equal(settled.wakeResult,'RUNTIME_FALLBACK');assert.equal(worker.model,'p/recovery');assert.equal(worker.model_variant,'high');assert.equal(worker.session_id,'recovery-1');assert.equal(calls.length,1)
  assert.deepEqual(worker.fallbacks,[],'recovery-only candidates stay separate from normal routing fallbacks')
  assert.match(worker.fallback_history.at(-1).reason,/bounded automatic recovery candidate/);assert.equal(m.execution.blockers.some(x=>x.startsWith('provider-failure:')),false)
})

test('native required-tool-choice compatibility APIError uses one bounded automatic recovery candidate',async()=>{
  const models=[{id:'p/recovery',provider:'p',writeCapable:true,tags:['coding','balanced']}]
  const {runtime,m,calls}=setup(async()=>{},true,models)
  const worker=m.execution.workers[0];worker.fallbacks=[];worker.recovery_candidates=['p/recovery'];worker.model_selection_reason=['visual capability recommendation','ephemeral automatic selection'];worker.requested_model=undefined
  m.execution.tasks[0].execution_profile.fallback_models=[];m.execution.tasks[0].execution_profile.fallback_variants={'p/recovery':'high'}
  const error={name:'APIError',message:'Upstream request failed: [invalid_request_error] only `\"auto\"` is supported for `tool_choice`. `\"none\"`, `\"required\"`, and named function choices are not currently supported',isRetryable:false,statusCode:400}
  const settled=await runtime.settleHostIdleRuntimeError(m,worker,error)
  assert.equal(settled.wakeResult,'RUNTIME_FALLBACK');assert.equal(worker.model,'p/recovery');assert.equal(worker.session_id,'recovery-1');assert.equal(calls.length,1)
  assert.match(worker.fallback_history.at(-1).reason,/bounded automatic recovery candidate/);assert.match(worker.fallback_history.at(-1).reason,/failure=provider-transport/)
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.failure.classified'&&e.payload?.reason==='opencode-required-tool-choice-compatibility-fallback-eligible'))
})

test('successive required-tool-choice compatibility failures advance through recovery-only candidates without bouncing',async()=>{
  const models=[{id:'p/deepseek',provider:'p',writeCapable:true,tags:['coding','balanced']},{id:'p/mimo',provider:'p',writeCapable:true,tags:['coding','balanced']}]
  const {runtime,m,calls}=setup(async()=>{},true,models)
  const worker=m.execution.workers[0];worker.fallbacks=[];worker.recovery_candidates=['p/deepseek','p/mimo'];worker.model_selection_reason=['visual capability recommendation','ephemeral automatic selection'];worker.requested_model=undefined
  m.execution.tasks[0].execution_profile.fallback_models=[];m.execution.tasks[0].execution_profile.fallback_variants={'p/deepseek':'high'}
  const first=await runtime.settleHostIdleRuntimeError(m,worker,{name:'APIError',message:'only `\"auto\"` is supported for `tool_choice`; `\"required\"` and named function choices are not currently supported',isRetryable:false,statusCode:400})
  assert.equal(first.wakeResult,'RUNTIME_FALLBACK');assert.equal(worker.model,'p/deepseek');assert.equal(worker.session_id,'recovery-1')
  worker.runtime_recovery_pending=false
  const second=await runtime.settleHostIdleRuntimeError(m,worker,{name:'APIError',message:'Thinking mode does not support this tool_choice',isRetryable:false,statusCode:400})
  assert.equal(second.wakeResult,'RUNTIME_FALLBACK');assert.equal(worker.model,'p/mimo');assert.equal(worker.session_id,'recovery-2')
  assert.deepEqual(calls.map(x=>x.body.model.modelID),['deepseek','mimo'])
  assert.deepEqual(worker.fallback_history.map(x=>x.to),['p/deepseek','p/mimo'])
  assert.equal(m.execution.blockers.some(x=>x.startsWith('provider-failure:')),false)
})

test('selected-model provider-policy 404 advances to the next authorized recovery candidate',async()=>{
  const models=[{id:'p/deepseek',provider:'p',writeCapable:true,tags:['coding','balanced']},{id:'p/mimo',provider:'p',writeCapable:true,tags:['coding','balanced']},{id:'p/qwen',provider:'p',writeCapable:true,tags:['coding','balanced']}]
  const {runtime,m,calls}=setup(async()=>{},true,models)
  const worker=m.execution.workers[0];worker.fallbacks=[];worker.recovery_candidates=['p/deepseek','p/mimo','p/qwen'];worker.model_selection_reason=['visual capability recommendation','ephemeral automatic selection'];worker.requested_model=undefined
  m.execution.tasks[0].execution_profile.fallback_models=[];m.execution.tasks[0].execution_profile.fallback_variants={'p/deepseek':'high'}
  const first=await runtime.settleHostIdleRuntimeError(m,worker,{name:'APIError',message:'only `\"auto\"` is supported for `tool_choice`; `\"required\"` and named function choices are not currently supported',isRetryable:false,statusCode:400})
  assert.equal(first.wakeResult,'RUNTIME_FALLBACK');assert.equal(worker.model,'p/deepseek');worker.runtime_recovery_pending=false
  const second=await runtime.settleHostIdleRuntimeError(m,worker,{name:'APIError',message:'Thinking mode does not support this tool_choice',isRetryable:false,statusCode:400})
  assert.equal(second.wakeResult,'RUNTIME_FALLBACK');assert.equal(worker.model,'p/mimo');worker.runtime_recovery_pending=false
  const third=await runtime.settleHostIdleRuntimeError(m,worker,{name:'APIError',message:"Upstream request failed: [404] No allowed providers are available for the selected model. Providers serving xiaomi/mimo-v2.5-20260422: gmicloud, deepinfra, xiaomi, but your request's provider.only preference permits only: tencent.",isRetryable:false,statusCode:404})
  assert.equal(third.wakeResult,'RUNTIME_FALLBACK');assert.equal(worker.model,'p/qwen');assert.equal(worker.session_id,'recovery-3')
  assert.deepEqual(calls.map(x=>x.body.model.modelID),['deepseek','mimo','qwen'])
  assert.deepEqual(worker.fallback_history.map(x=>x.to),['p/deepseek','p/mimo','p/qwen'])
  assert.equal(m.execution.blockers.some(x=>x.startsWith('provider-failure:')),false)
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.failure.classified'&&e.payload?.reason==='opencode-selected-model-provider-unavailable-fallback-eligible'))
})

test('explicit task model does not gain automatic authority from required-tool-choice compatibility failure',async()=>{
  const models=[{id:'p/recovery',provider:'p',writeCapable:true,tags:['coding']}]
  const {runtime,m,calls}=setup(async()=>{},true,models)
  const worker=m.execution.workers[0];worker.fallbacks=[];worker.recovery_candidates=['p/recovery'];worker.model_selection_reason=['ephemeral automatic selection'];worker.requested_model='p/primary'
  const error={name:'APIError',message:'only `\"auto\"` is supported for `tool_choice`; `\"required\"` and named function choices are not currently supported',isRetryable:false,statusCode:400}
  const settled=await runtime.settleHostIdleRuntimeError(m,worker,error)
  assert.equal(settled.wakeResult,'BLOCKED');assert.equal(calls.length,0);assert.equal(worker.model,'p/primary');assert.ok(m.execution.blockers.some(x=>x.startsWith('provider-failure:provider-transport:')))
})

test('explicit task model never gains automatic recovery authority from recovery_candidates',async()=>{
  const models=[{id:'p/recovery',provider:'p',writeCapable:true,tags:['coding']}]
  const {runtime,m,calls}=setup(async()=>{},true,models)
  const worker=m.execution.workers[0];worker.fallbacks=[];worker.recovery_candidates=['p/recovery'];worker.model_selection_reason=['ephemeral automatic selection'];worker.requested_model='p/primary'
  const settled=await runtime.settleHostIdleRuntimeError(m,worker,{name:'APIError',message:'503 Endpoint is unavailable',isRetryable:true,statusCode:503})
  assert.equal(settled.wakeResult,'BLOCKED');assert.equal(calls.length,0);assert.equal(worker.model,'p/primary');assert.ok(m.execution.blockers.some(x=>x.startsWith('provider-failure:provider-transport:')))
})

test('provider fallback chain never bounces back to an already attempted model',async()=>{
  const models=[{id:'p/fallback1',provider:'p',writeCapable:true,tags:['coding']},{id:'p/fallback2',provider:'p',writeCapable:true,tags:['coding']}]
  const {runtime,m}=setup(async()=>{},true,models)
  const worker=m.execution.workers[0]
  assert.equal((await runtime.settleHostIdleRuntimeError(m,worker,{name:'APIError',message:'503 primary unavailable',isRetryable:true,statusCode:503})).wakeResult,'RUNTIME_FALLBACK')
  worker.runtime_recovery_pending=false
  assert.equal((await runtime.settleHostIdleRuntimeError(m,worker,{name:'APIError',message:'503 fallback one unavailable',isRetryable:true,statusCode:503})).wakeResult,'RUNTIME_FALLBACK')
  worker.runtime_recovery_pending=false
  const third=await runtime.settleHostIdleRuntimeError(m,worker,{name:'APIError',message:'503 fallback two unavailable',isRetryable:true,statusCode:503})
  assert.equal(third.wakeResult,'BLOCKED');assert.equal(worker.model,'p/fallback2');assert.deepEqual(worker.fallback_history.map(x=>x.to),['p/fallback1','p/fallback2'])
  const exhausted=m.execution.ledger.findLast(e=>e.type==='worker.runtime-fallback.exhausted');assert.ok(exhausted);assert.deepEqual(new Set(exhausted.payload.attempted),new Set(['p/primary','p/fallback1','p/fallback2']))
})

test('blocked automatic provider failure can resume the same task on its next recovery-only candidate',async()=>{
  const models=[{id:'p/recovery',provider:'p',writeCapable:true,tags:['coding','balanced']}]
  const {runtime,m,calls}=setup(async()=>{},true,models)
  const worker=m.execution.workers[0],task=m.execution.tasks[0];worker.session_id=undefined;worker.status='ready';worker.fallbacks=[];worker.recovery_candidates=['p/recovery'];worker.model_selection_reason=['ephemeral automatic selection'];worker.requested_model=undefined;worker.last_runtime_failure_kind='provider-transport';worker.runtime_fallback_exhausted=true;task.status='blocked';task.result={status:'BLOCKED',summary:'Runtime provider/model fallback chain exhausted.',changed_files:[],evidence:[],open_issues:['provider-failure:provider-transport:p/primary'],needs_context:['provider/model availability or alternate execution path']};m.execution.blockers=['provider-failure:provider-transport:p/primary','unrelated-blocker']
  const out=await runtime.resume(m,task.id)
  assert.equal(out.task_id,task.id);assert.equal(out.worker_id,worker.id);assert.equal(out.model,'p/recovery');assert.equal(out.session_id,'recovery-1');assert.equal(task.status,'running');assert.equal(worker.runtime_fallback_exhausted,false);assert.equal(calls.length,1)
  assert.deepEqual(m.execution.blockers,['unrelated-blocker'],'resume clears only the provider blocker owned by this task')
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.runtime-fallback.resumed-blocked'&&e.task_id===task.id))
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


test('behavioral hazard opens one fresh recovery-only model after one correction repeats the same normalized failure',async()=>{
  const models=[{id:'p/recovery',provider:'p',writeCapable:true,tags:['coding','balanced']}]
  const {runtime,m,calls,aborts}=setup(async()=>{},true,models,undefined,'idle')
  const worker=m.execution.workers[0],task=m.execution.tasks[0]
  worker.status='ready';task.status='waiting';worker.recovery_candidates=['p/recovery'];worker.fallbacks=[];task.result={status:'FIX_REQUIRED',summary:'contract invalid',changed_files:[],evidence:[],open_issues:['worker-result-contract-invalid'],needs_context:['worker-result-contract-retry: evidence must be nested']}
  recordRecoveryStrategy(m,{level:1,action:'same-worker-resume'},'started',10,{task_id:task.id,worker_id:worker.id,model:'p/primary'})
  m.continuation.stagnation_count=2
  const recovered=await runtime.recoverStagnation(m,3,'model-escalation')
  assert.equal(recovered,true);assert.equal(worker.model,'p/recovery');assert.equal(worker.session_id,'recovery-1');assert.equal(worker.forked_from_session_id,'child1')
  assert.equal(calls.length,1);assert.deepEqual(calls[0].body.model,{providerID:'p',modelID:'recovery'});assert.equal(aborts.length,0,'idle prior child is not destructively replayed or aborted')
  assert.equal(worker.fallbacks.length,0,'recovery-only candidate must not become a normal provider fallback')
  assert.match(worker.fallback_history.at(-1).reason,/one repeated same-failure correction/i)
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.behavioral-model-escalation'&&e.payload?.from==='p/primary'&&e.payload?.to==='p/recovery'))
})

test('behavioral model escalation is fail-closed before any same-failure correction is consumed',async()=>{
  const models=[{id:'p/recovery',provider:'p',writeCapable:true,tags:['coding']}]
  const {runtime,m,calls}=setup(async()=>{},true,models,undefined,'idle')
  const worker=m.execution.workers[0],task=m.execution.tasks[0]
  worker.status='ready';task.status='waiting';worker.recovery_candidates=['p/recovery'];worker.fallbacks=[];task.result={status:'FIX_REQUIRED',summary:'contract invalid',changed_files:[],evidence:[],open_issues:['worker-result-contract-invalid'],needs_context:['worker-result-contract-retry']}
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

test('native structured WorkerResult is authoritative over compatibility text and settles normally',async()=>{
  const {runtime,m}=setup()
  const worker=m.execution.workers[0],task=m.execution.tasks[0];worker.projected_model='p/primary'
  const structured={status:'FIX_REQUIRED',summary:'native structured correction',changed_files:[],evidence:[],open_issues:['worker-result-contract-invalid'],needs_context:['fix exact result']}
  const settled=await runtime.settleHostIdleAssistantResult(m,worker,{text:'{"status":"DONE","source-provenance-evidence":{}}',structured,model:{model:'p/primary'}})
  assert.equal(settled.applied,true);assert.equal(settled.result?.summary,'native structured correction');assert.equal(task.result.summary,'native structured correction')
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.structured-result-admitted'))
})

test('transport-valid native structured payload is normalized before canonical settlement instead of generic contract retry',async()=>{
  const {runtime,m}=setup()
  const worker=m.execution.workers[0],task=m.execution.tasks[0];worker.projected_model='p/primary'
  const structured={status:'FIX_REQUIRED',summary:'transport-valid with noncanonical optional coverage',changed_files:[],evidence:[],verification_coverage:[{case_id:'desktop-layout',outcome:'passed',evidence_refs:['ev_full_ref']}],open_issues:['visual coverage still needs canonical task cases'],needs_context:['return exact vc_* case IDs']}
  const settled=await runtime.settleHostIdleAssistantResult(m,worker,{structured,model:{model:'p/primary'}})
  assert.equal(settled.applied,true);assert.equal(settled.result?.status,'FIX_REQUIRED');assert.equal(settled.result?.verification_coverage,undefined)
  const admitted=m.execution.ledger.findLast(e=>e.type==='worker.structured-result-admitted');assert.equal(admitted?.payload?.normalized,true)
  assert.equal(m.execution.ledger.some(e=>e.type==='worker.structured-result-invalid'),false);assert.equal(task.result.summary,'transport-valid with noncanonical optional coverage')
})

test('transport-valid review finding that loses canonical evidence binding fails closed instead of disappearing',async()=>{
  const {runtime,m}=setup()
  const worker=m.execution.workers[0],task=m.execution.tasks[0];worker.projected_model='p/primary';worker.role='qa-reviewer';task.role='qa-reviewer'
  const structured={status:'FIX_REQUIRED',summary:'finding with wrong proof kind',changed_files:[],evidence:[{kind:'review-evidence',summary:'reviewed target',scope:['src/a.ts'],pass:true,outcome:'passed'}],findings:[{id:'rf-live-proof-mismatch',reviewer_role:'qa-reviewer',subject:'proof kind mismatch',severity:'high',causality:'introduced',scope:['src/a.ts'],evidence_refs:['browser-evidence'],confidence:'high',disposition:'open',blocking:true}],open_issues:[],needs_context:[]}
  const settled=await runtime.settleHostIdleAssistantResult(m,worker,{structured,model:{model:'p/primary'}})
  assert.equal(settled.applied,true);assert.equal(settled.result?.status,'FIX_REQUIRED')
  assert.ok(task.result.open_issues.includes('worker-result-contract-invalid:review-finding'))
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.structured-result-invalid'&&e.payload?.reason==='review-finding-canonical-projection-loss'))
  assert.equal(m.execution.ledger.some(e=>e.type==='worker.structured-result-admitted'),false)
})

test('non-reviewer reviewer-shaped findings are ignored before canonical normalization and cannot poison task liveness',async()=>{
  const {runtime,m}=setup()
  const worker=m.execution.workers[0],task=m.execution.tasks[0];worker.projected_model='p/primary'
  const structured={status:'DONE',summary:'coder work complete',changed_files:[],evidence:[{kind:'targeted-tests',summary:'tests passed',pass:true,outcome:'passed'}],findings:[{blocking:true,causality:'introduced',confidence:'high',disposition:'open',evidence_refs:['review-evidence'],id:'rf-unauthorized-coder-finding',reviewer_role:'security-reviewer',scope:['src/a.ts'],severity:'high',subject:'coder attempted to emit reviewer authority'}],open_issues:[],needs_context:[]}
  const settled=await runtime.settleHostIdleAssistantResult(m,worker,{structured,model:{model:'p/primary'}})
  assert.equal(settled.applied,true);assert.equal(settled.result?.status,'DONE');assert.equal(task.status,'completed');assert.equal(task.result.findings,undefined)
  assert.ok(m.execution.ledger.some(e=>e.type==='review.finding-authority-ignored'&&e.worker_id===worker.id))
  assert.equal(m.execution.ledger.some(e=>e.type==='worker.structured-result-invalid'&&e.payload?.reason==='review-finding-canonical-projection-loss'),false)
})

test('canonical reviewer findings do not fail projection solely because JSON object key order differs',async()=>{
  const {runtime,m}=setup()
  const worker=m.execution.workers[0],task=m.execution.tasks[0];worker.projected_model='p/primary';worker.role='qa-reviewer';task.role='qa-reviewer'
  const structured={status:'FIX_REQUIRED',summary:'review finding',changed_files:[],evidence:[{kind:'review-evidence',summary:'reviewed',pass:true,outcome:'passed'}],findings:[{blocking:true,causality:'introduced',confidence:'high',disposition:'open',evidence_refs:['review-evidence'],id:'rf-key-order-control',reviewer_role:'qa-reviewer',scope:['src/a.ts'],severity:'high',subject:'real reviewer finding'}],open_issues:[],needs_context:[]}
  const settled=await runtime.settleHostIdleAssistantResult(m,worker,{structured,model:{model:'p/primary'}})
  assert.equal(settled.applied,true);assert.equal(settled.result?.status,'FIX_REQUIRED');assert.equal(settled.result?.findings?.[0]?.id,'rf-key-order-control')
  assert.equal(m.execution.ledger.some(e=>e.type==='worker.structured-result-invalid'&&e.payload?.reason==='review-finding-canonical-projection-loss'),false)
})

test('malformed native structured core envelope remains fail-closed before normalization',async()=>{
  const {runtime,m}=setup()
  const worker=m.execution.workers[0],task=m.execution.tasks[0];worker.projected_model='p/primary'
  const settled=await runtime.settleHostIdleAssistantResult(m,worker,{structured:{status:'DONE',summary:'missing core arrays'},model:{model:'p/primary'}})
  assert.equal(settled.applied,true);assert.equal(settled.result?.status,'FIX_REQUIRED');assert.ok(settled.result?.open_issues.includes('worker-result-contract-invalid:structured-payload'))
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.structured-result-invalid'&&e.payload?.reason==='transport-shape-invalid'));assert.equal(task.status,'waiting')
})

test('terminal StructuredOutputError becomes resumable WorkerResult FIX_REQUIRED instead of provider/runtime failure',async()=>{
  const {runtime,m,calls}=setup()
  const worker=m.execution.workers[0],task=m.execution.tasks[0]
  const settled=await runtime.settleHostIdleRuntimeError(m,worker,{name:'StructuredOutputError',message:'Model did not produce structured output'})
  assert.equal(settled.applied,true);assert.equal(settled.wakeResult,'FIX_REQUIRED');assert.equal(settled.result?.status,'FIX_REQUIRED');assert.equal(task.status,'waiting');assert.equal(worker.status,'ready');assert.equal(calls.length,0)
  assert.ok(task.result.open_issues.includes('worker-result-contract-invalid:structured-output'));assert.equal(worker.last_runtime_failure_kind,undefined)
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.result-contract-retryable'&&e.payload?.transport==='opencode-json-schema'))
})

test('normal task_id correction switches to a fresh recovery-only model when the first correction repeats the same failure',async()=>{
  const models=[
    {id:'p/primary',provider:'p',writeCapable:true,tags:['coding','balanced']},
    {id:'p/recovery',provider:'p',writeCapable:true,tags:['coding','balanced']},
  ]
  const {runtime,m,calls}=setup(async()=>{},true,models,undefined,'idle')
  const worker=m.execution.workers[0],task=m.execution.tasks[0]
  worker.status='ready';task.status='waiting';worker.fallbacks=[];worker.recovery_candidates=['p/recovery'];worker.requested_model=undefined
  task.result={status:'FIX_REQUIRED',summary:'contract correction required',changed_files:[],evidence:[],open_issues:['worker-result-contract-invalid'],needs_context:['return structured WorkerResult']}

  const first=await runtime.resume(m,task.id)
  assert.equal(first.session_id,'child1');assert.equal(first.model,'p/primary');assert.equal(calls.length,1)
  let history=m.continuation.recovery_history?.filter(x=>x.task_id===task.id&&x.worker_id===worker.id&&x.action==='same-worker-resume')??[]
  assert.deepEqual(history.map(x=>x.level),[1]);assert.ok(history[0].failure_signature)
  runtime.applyResult(m,worker.id,{status:'FIX_REQUIRED',summary:'same normalized failure again',changed_files:[],evidence:[],open_issues:['worker-result-contract-invalid'],needs_context:['return structured WorkerResult']})

  const second=await runtime.resume(m,task.id)
  assert.equal(second.worker_id,worker.id);assert.equal(second.model,'p/recovery');assert.equal(second.session_id,'recovery-1');assert.equal(calls.length,2)
  history=m.continuation.recovery_history?.filter(x=>x.task_id===task.id&&x.worker_id===worker.id&&x.action==='same-worker-resume')??[]
  assert.deepEqual(history.map(x=>x.level),[1],'same-model correction must not get a level-2 replay for the same failure')
  assert.deepEqual(worker.fallbacks,[]);assert.equal(worker.forked_from_session_id,'child1')
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.behavioral-model-escalation'&&e.payload?.from==='p/primary'&&e.payload?.to==='p/recovery'))
})

test('same failure with no authorized recovery model refuses a second same-model corrective prompt',async()=>{
  const models=[{id:'p/primary',provider:'p',writeCapable:true,tags:['coding']}]
  const {runtime,m,calls}=setup(async()=>{},true,models,undefined,'idle')
  const worker=m.execution.workers[0],task=m.execution.tasks[0]
  worker.status='ready';task.status='waiting';worker.fallbacks=[];worker.recovery_candidates=[];worker.requested_model=undefined
  task.result={status:'FIX_REQUIRED',summary:'contract correction required',changed_files:[],evidence:[],open_issues:['worker-result-contract-invalid'],needs_context:['return structured WorkerResult']}
  await runtime.resume(m,task.id);assert.equal(calls.length,1)
  runtime.applyResult(m,worker.id,{status:'FIX_REQUIRED',summary:'same normalized failure again',changed_files:[],evidence:[],open_issues:['worker-result-contract-invalid'],needs_context:['return structured WorkerResult']})
  await assert.rejects(()=>runtime.resume(m,task.id),/Same-model corrective recovery is exhausted/);assert.equal(calls.length,1)
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.same-model-correction-exhausted'))
})


test('busy/retry child remains verified inflight after repeated bounded await timeouts and is never stall-aborted',async()=>{
  const models=[{id:'p/recovery',provider:'p',writeCapable:true,tags:['coding','balanced']}]
  const {runtime,m,calls,aborts}=setup(async()=>{},true,models)
  const worker=m.execution.workers[0],task=m.execution.tasks[0];worker.attempt=1;worker.recovery_candidates=['p/recovery']
  for(const timeout_ms of [30_000,60_000,60_000])appendLedger(m,'worker.await-timeout',{task_id:task.id,worker_id:worker.id,payload:{session_id:'child1',attempt:1,timeout_ms}})
  const assessment=await runtime.assessLiveness(m,Date.now()+180_000,{})
  assert.equal(assessment.state,'ACTIVE');assert.equal(assessment.inflight,'YES');assert.equal(assessment.destructive_recovery_allowed,false)
  assert.equal(aborts.length,0);assert.equal(calls.length,0);assert.equal(worker.session_id,'child1');assert.equal(worker.model,'p/primary');assert.equal(task.status,'running')
})

test('unique OpenCode assistant activity is durable progress while busy/retry remains inflight rather than stall',async()=>{
  let observedAt=Date.now()+120_000
  const {runtime,m,calls,aborts}=setup(async()=>{},true,[],async()=>({text:'',activity:{message_id:'msg-progress',observed_at:observedAt,output_tokens:42,reasoning_tokens:7,tool_calls:1,text_chars:18}}))
  const task=m.execution.tasks[0],worker=m.execution.workers[0];for(const timeout_ms of [60_000,60_000,60_000])appendLedger(m,'worker.await-timeout',{task_id:task.id,worker_id:worker.id,payload:{session_id:'child1',attempt:worker.attempt,timeout_ms}})
  const assessment=await runtime.assessLiveness(m,observedAt+1,{})
  assert.equal(assessment.state,'ACTIVE');assert.equal(assessment.inflight,'YES');assert.equal(assessment.last_durable_progress_at,observedAt)
  assert.ok(m.execution.ledger.some(e=>e.type==='assistant.progress-observed'&&e.payload?.message_id==='msg-progress'));assert.equal(aborts.length,0);assert.equal(calls.length,0)
})

test('busy host remains verified inflight when assistant activity is unavailable or unreadable',async()=>{
  for(const reader of [null,async()=>{throw new Error('message surface unavailable')}]){
    const {runtime,m,calls,aborts}=setup(async()=>{},true,[],reader)
    const assessment=await runtime.assessLiveness(m,Date.now()+180_000,{})
    assert.equal(assessment.state,'ACTIVE');assert.equal(assessment.inflight,'YES');assert.equal(assessment.destructive_recovery_allowed,false);assert.equal(aborts.length,0);assert.equal(calls.length,0)
  }
})

test('lack of a recovery model never authorizes replacement while old exact execution is busy',async()=>{
  const {runtime,m,calls,aborts}=setup(async()=>{},true,[])
  const worker=m.execution.workers[0],task=m.execution.tasks[0];worker.recovery_candidates=[]
  const assessment=await runtime.assessLiveness(m,Date.now()+180_000,{})
  const recovery=await runtime.recoverStalledExecution(m,assessment)
  assert.equal(assessment.inflight,'YES');assert.equal(recovery.disposition,'NOOP');assert.equal(recovery.reason,'canonical-stall-not-admitted')
  assert.equal(aborts.length,0);assert.equal(calls.length,0);assert.equal(worker.session_id,'child1');assert.equal(worker.status,'busy');assert.equal(task.status,'running')
})
test('canonical STALLED assessment on quiescent exact session unlocks bounded same-session recovery',async()=>{
  const {runtime,m,calls,aborts}=setup(async()=>{},true,[],undefined,'idle')
  const worker=m.execution.workers[0],task=m.execution.tasks[0];worker.status='ready';task.status='waiting'
  const assessment=await runtime.assessLiveness(m,Date.now()+180_000,{})
  assert.equal(assessment.state,'STALLED');assert.equal(assessment.inflight,'NO');assert.equal(assessment.destructive_recovery_allowed,true)
  const recovery=await runtime.recoverStalledExecution(m,assessment)
  assert.equal(recovery.disposition,'RECOVERED');assert.equal(recovery.reason,'canonical-stall-quiescent-resume');assert.equal(worker.session_id,'child1');assert.equal(worker.status,'busy');assert.equal(task.status,'running');assert.equal(aborts.length,0);assert.equal(calls.length,1)
})
