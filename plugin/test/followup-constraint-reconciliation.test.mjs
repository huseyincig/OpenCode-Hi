import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createChatMessageHook} from '../dist/hooks/chat-message.js'
import {createSystemTransformHook} from '../dist/hooks/system-transform.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {makeChildSessionPort,opencodeChildPort} from './helpers/host-port.mjs'

function initial(store,id,overrides={}){
  const m=store.start(id,'opaque initial request')
  store.applyInitialSemanticAssessment(id,{material:true,message_kind:'mission',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:['src/auth.ts'],intent_signals:[],suppressed_intent_signals:[],...overrides})
  return m
}
function callHook(hook,sessionID,userText){return hook({sessionID},{message:{role:'user'},parts:[{type:'text',text:userText}]})}

test('chat hook opens a semantic follow-up revision without classifying prose',async()=>{
  const store=new MissionStore(),m=initial(store,'followup-pending')
  const before=m.identity.semantic_assessment.revision
  await callHook(createChatMessageHook(store),'followup-pending','Beliebige Folgeanweisung')
  assert.equal(m.identity.semantic_assessment.status,'pending')
  assert.equal(m.identity.semantic_assessment.phase,'followup')
  assert.equal(m.identity.semantic_assessment.revision,before+1)
  assert.equal(m.identity.semantic_assessment.pending_text,'Beliebige Folgeanweisung')
})

test('structured verification follow-up updates verification state without creating implementation work',async()=>{
  const store=new MissionStore(),m=initial(store,'verify-followup')
  const implementationBefore=m.execution.obligations.filter(o=>o.kind==='implementation').length
  await callHook(createChatMessageHook(store),'verify-followup','opaque verification follow-up')
  store.applyFollowupSemanticAssessment('verify-followup',{material:true,message_kind:'verification',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','verification'],requested_external_actions:[],likely_verification:['targeted-tests','typecheck'],likely_targets:['src/auth.ts'],intent_signals:[],suppressed_intent_signals:[]})
  assert.equal(m.execution.obligations.filter(o=>o.kind==='implementation').length,implementationBefore)
  assert.equal(m.execution.obligations.find(o=>o.kind==='verification')?.status,'open')
  assert.deepEqual(m.execution.verification_policy.requiredKinds,['targeted-tests'],'model-inferred typecheck is dropped when the repository exposes test/check but no typecheck route')
})



test('structured verification follow-up preserves explicit user_verification even without a repo route',async()=>{
  const store=new MissionStore(),m=initial(store,'verify-followup-explicit')
  await callHook(createChatMessageHook(store),'verify-followup-explicit','Run `npm run typecheck` as the requested verification.')
  store.applyFollowupSemanticAssessment('verify-followup-explicit',{material:true,message_kind:'verification',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','verification'],requested_external_actions:[],likely_verification:['targeted-tests','typecheck'],user_verification:['typecheck'],verification_ceiling:false,likely_targets:['src/auth.ts'],intent_signals:[],suppressed_intent_signals:[]})
  assert.deepEqual(m.execution.verification_policy.requiredKinds,['typecheck'])
  assert.deepEqual(m.execution.obligations.find(o=>o.kind==='verification')?.requiredEvidence,['typecheck'])
})

test('structured constraint follow-up rebases a busy worker onto a fresh session without duplicate identity',async()=>{
  const store=new MissionStore(),m=initial(store,'constraint-runtime')
  const task=createTask(m,{objective:'bounded auth change',role:'coder',category:'standard',scope:['src/auth.ts']})
  const worker=createWorker(m,task,'p/code');worker.session_id='child-old';worker.status='busy';worker.started_at=Date.now();task.status='running'
  const background=new BackgroundRegistry();background.set(worker)
  const calls={aborts:0,creates:0,prompts:0}
  const client={session:{abort:async()=>{calls.aborts++;return{data:true}},create:async()=>{calls.creates++;return{data:{id:'child-new'}}},promptAsync:async()=>{calls.prompts++}}}
  const runtime=new TaskRuntime(opencodeChildPort(client),background,createConcurrencyPolicySource(()=>({global:4,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[{id:'p/code',provider:'p',quality:5,cost:1,tags:['coding']}],()=>({}))
  const taskCount=m.execution.tasks.length,workerCount=m.execution.workers.length
  await callHook(createChatMessageHook(store),'constraint-runtime','任意の制約テキスト')
  store.applyFollowupSemanticAssessment('constraint-runtime',{material:true,message_kind:'constraint',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:['src/auth.ts'],intent_signals:[],suppressed_intent_signals:[]})
  const reconciled=await runtime.reconcileUserConstraint(m,'任意の制約テキスト')
  assert.equal(reconciled,1)
  assert.equal(m.execution.tasks.length,taskCount);assert.equal(m.execution.workers.length,workerCount)
  assert.equal(worker.session_id,'child-new');assert.equal(worker.generation_at_spawn,m.continuation.generation)
  assert.equal(m.execution.scheduler.reservations.length,1);assert.equal(m.execution.scheduler.reservations[0].workerId,worker.id);assert.equal(m.execution.scheduler.reservations[0].hostExecutionId,'child-new');assert.equal(m.execution.scheduler.reservations[0].phase,'RUNNING')
  assert.deepEqual(worker.loaded_methodologies,[])
  assert.equal(calls.aborts,1);assert.equal(calls.creates,1);assert.equal(calls.prompts,1)
  assert.ok(task.constraints.includes('任意の制約テキスト'))
})

test('semantic follow-up does not auto-retry a ready child that already returned a terminal result',async()=>{
  const store=new MissionStore(),m=initial(store,'terminal-result-parent-reconcile')
  const task=createTask(m,{objective:'bounded analysis',role:'repository-explorer',category:'standard',scope:['src/auth.ts'],obligationIds:[m.execution.obligations.find(o=>o.kind==='analysis')?.id].filter(Boolean)})
  const worker=createWorker(m,task,'p/code');worker.session_id='child-existing';worker.status='ready';task.status='blocked';task.result={status:'NEEDS_CONTEXT',summary:'bounded read-only result requires parent reconciliation',changed_files:[],evidence:[],open_issues:['downstream implementation owner required'],needs_context:['parent must decide the next owner']}
  const background=new BackgroundRegistry();background.set(worker)
  const calls={prompts:0};const client={session:{promptAsync:async()=>{calls.prompts++}}}
  const runtime=new TaskRuntime(opencodeChildPort(client),background,createConcurrencyPolicySource(()=>({global:4,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[{id:'p/code',provider:'p',quality:5,cost:1,tags:['coding']}],()=>({}))
  await callHook(createChatMessageHook(store),'terminal-result-parent-reconcile','opaque follow-up')
  const revision=m.identity.semantic_assessment.revision;worker.semantic_pause_revision=revision
  store.applyFollowupSemanticAssessment('terminal-result-parent-reconcile',{material:true,message_kind:'resume',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:['src/auth.ts'],intent_signals:[],suppressed_intent_signals:[]})
  const resumed=await runtime.resumeAfterSemanticAssessment(m,'resume')
  assert.equal(resumed,0);assert.equal(calls.prompts,0);assert.equal(worker.status,'ready');assert.equal(task.status,'blocked');assert.equal(worker.session_id,'child-existing');assert.equal(task.result.status,'NEEDS_CONTEXT');assert.equal(worker.semantic_pause_revision,undefined)
  assert.equal(worker.generation_at_spawn,m.continuation.generation)
  assert.equal(runtime.childCallbackDisposition(m,worker),'accept')
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.semantic-result-awaits-parent-reconcile'&&e.task_id===task.id&&e.worker_id===worker.id))
})

test('semantic resume deterministically reconciles an exact idle child result before model continuation',async()=>{
  const store=new MissionStore(),m=initial(store,'terminal-result-deterministic-reconcile')
  const task=createTask(m,{objective:'bounded support task',role:'coder',category:'standard',scope:[],obligationIds:[]})
  const worker=createWorker(m,task,'p/code');worker.session_id='child-existing';worker.status='ready';task.status='waiting';task.result={status:'NEEDS_CONTEXT',summary:'prior host turn incomplete',changed_files:[],evidence:[],open_issues:[],needs_context:['host result readback pending']}
  const background=new BackgroundRegistry();background.set(worker)
  let prompts=0
  const child=makeChildSessionPort({status:async()=> 'idle',prompt:async()=>{prompts++}})
  const readAssistantResult=async()=>({text:'',model:{model:'p/code',message_id:'msg-terminal',created_at:Date.now()},structured:{status:'DONE',summary:'exact child completed',changed_files:[],evidence:[],open_issues:[],needs_context:[],context_gap:'none',failure_finding:'none'}})
  const runtime=new TaskRuntime(child,background,createConcurrencyPolicySource(()=>({global:4,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[{id:'p/code',provider:'p',quality:5,cost:1,tags:['coding']}],()=>({}),undefined,[],undefined,undefined,undefined,undefined,undefined,readAssistantResult)
  await callHook(createChatMessageHook(store),'terminal-result-deterministic-reconcile','continue')
  worker.semantic_pause_revision=m.identity.semantic_assessment.revision
  store.applyFollowupSemanticAssessment('terminal-result-deterministic-reconcile',{material:true,message_kind:'resume',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:['src/auth.ts'],intent_signals:[],suppressed_intent_signals:[]})
  const resumed=await runtime.resumeAfterSemanticAssessment(m,'resume')
  assert.equal(resumed,1)
  assert.equal(prompts,0,'terminal result reconciliation must not send a new child/model prompt')
  assert.equal(worker.status,'completed');assert.equal(task.status,'completed');assert.equal(task.result.status,'DONE')
  assert.equal(worker.generation_at_spawn,m.continuation.generation);assert.equal(worker.semantic_pause_revision,undefined)
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.await-idle-result-reconciled'&&e.worker_id===worker.id))
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.semantic-terminal-result-reconciled'&&e.worker_id===worker.id))
})

test('parent system contract exposes semantic gate while pending and structured constraint after assessment',async()=>{
  const store=new MissionStore(),background=new BackgroundRegistry();const m=initial(store,'direct-constraint',{task_kind:'implementation',likely_verification:[]})
  await callHook(createChatMessageHook(store),'direct-constraint','opaque constraint')
  const pending={system:[]};await createSystemTransformHook(store,background)({sessionID:'direct-constraint'},pending)
  assert.match(pending.system[0],/SEMANTIC ASSESSMENT GATE/)
  store.applyFollowupSemanticAssessment('direct-constraint',{material:true,message_kind:'constraint',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]})
  const output={system:[]};await createSystemTransformHook(store,background)({sessionID:'direct-constraint'},output)
  assert.match(output.system.join('\n'),/constraints: opaque constraint/)
  assert.equal(m.execution.tasks.length,0)
})
