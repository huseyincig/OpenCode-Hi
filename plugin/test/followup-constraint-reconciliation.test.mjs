import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createChatMessageHook} from '../dist/hooks/chat-message.js'
import {createSystemTransformHook} from '../dist/hooks/system-transform.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'
import {resolveHiConfig} from '../dist/config/resolver.js'

function initial(store,id,overrides={}){
  const m=store.start(id,'opaque initial request')
  store.applyInitialSemanticAssessment(id,{material:true,message_kind:'mission',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:['src/auth.ts'],intent_signals:[],suppressed_intent_signals:[],...overrides})
  return m
}
function callHook(hook,sessionID,userText){return hook({sessionID,message:{role:'user',parts:[{type:'text',text:userText}]}},{parts:[]})}

test('chat hook opens a semantic follow-up revision without classifying prose',async()=>{
  const store=new MissionStore(),m=initial(store,'followup-pending')
  const before=m.semantic_assessment.revision
  await callHook(createChatMessageHook(store),'followup-pending','Beliebige Folgeanweisung')
  assert.equal(m.semantic_assessment.status,'pending')
  assert.equal(m.semantic_assessment.phase,'followup')
  assert.equal(m.semantic_assessment.revision,before+1)
  assert.equal(m.semantic_assessment.pending_text,'Beliebige Folgeanweisung')
})

test('structured verification follow-up updates verification state without creating implementation work',async()=>{
  const store=new MissionStore(),m=initial(store,'verify-followup')
  const implementationBefore=m.obligations.filter(o=>o.kind==='implementation').length
  await callHook(createChatMessageHook(store),'verify-followup','opaque verification follow-up')
  store.applyFollowupSemanticAssessment('verify-followup',{material:true,message_kind:'verification',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','verification'],requested_external_actions:[],likely_verification:['targeted-tests','typecheck'],likely_targets:['src/auth.ts'],intent_signals:[],suppressed_intent_signals:[]})
  assert.equal(m.obligations.filter(o=>o.kind==='implementation').length,implementationBefore)
  assert.equal(m.obligations.find(o=>o.kind==='verification')?.status,'open')
  assert.deepEqual(m.verification_policy.requiredKinds,['targeted-tests','typecheck'])
})

test('structured constraint follow-up rebases a busy worker onto a fresh session without duplicate identity',async()=>{
  const store=new MissionStore(),m=initial(store,'constraint-runtime')
  const task=createTask(m,{objective:'bounded auth change',role:'coder',category:'standard',scope:['src/auth.ts']})
  const worker=createWorker(m,task,'p/code');worker.session_id='child-old';worker.status='busy';worker.started_at=Date.now();task.status='running'
  const background=new BackgroundRegistry();background.set(worker)
  const calls={aborts:0,creates:0,prompts:0}
  const client={session:{abort:async()=>{calls.aborts++},create:async()=>{calls.creates++;return{data:{id:'child-new'}}},promptAsync:async()=>{calls.prompts++}}}
  const runtime=new TaskRuntime(client,background,new ConcurrencyScheduler(()=>({global:4,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[{id:'p/code',provider:'p',quality:5,cost:1,tags:['coding']}],()=>({}))
  const taskCount=m.tasks.length,workerCount=m.workers.length
  await callHook(createChatMessageHook(store),'constraint-runtime','任意の制約テキスト')
  store.applyFollowupSemanticAssessment('constraint-runtime',{material:true,message_kind:'constraint',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:['src/auth.ts'],intent_signals:[],suppressed_intent_signals:[]})
  const reconciled=await runtime.reconcileUserConstraint(m,'任意の制約テキスト')
  assert.equal(reconciled,1)
  assert.equal(m.tasks.length,taskCount);assert.equal(m.workers.length,workerCount)
  assert.equal(worker.session_id,'child-new');assert.equal(worker.generation_at_spawn,m.generation)
  assert.deepEqual(worker.loaded_methodologies,[])
  assert.equal(calls.aborts,1);assert.equal(calls.creates,1);assert.equal(calls.prompts,1)
  assert.ok(task.constraints.includes('任意の制約テキスト'))
})

test('parent system contract exposes semantic gate while pending and structured constraint after assessment',async()=>{
  const store=new MissionStore(),background=new BackgroundRegistry();const m=initial(store,'direct-constraint',{task_kind:'implementation',likely_verification:[]})
  await callHook(createChatMessageHook(store),'direct-constraint','opaque constraint')
  const pending={system:[]};await createSystemTransformHook(store,background)({sessionID:'direct-constraint'},pending)
  assert.match(pending.system[0],/SEMANTIC ASSESSMENT GATE/)
  store.applyFollowupSemanticAssessment('direct-constraint',{material:true,message_kind:'constraint',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]})
  const output={system:[]};await createSystemTransformHook(store,background)({sessionID:'direct-constraint'},output)
  assert.match(output.system[0],/Current user constraints: opaque constraint/)
  assert.equal(m.tasks.length,0)
})
