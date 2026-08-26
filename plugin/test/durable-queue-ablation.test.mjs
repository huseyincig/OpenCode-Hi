import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {opencodeChildPort} from './helpers/host-port.mjs'
import {startAssessedMission} from './helpers/semantic.mjs'

function runtime(created=[],options={}){
  let n=0
  const client={session:{create:async()=>{const id=`child-${++n}`;created.push(id);return{data:{id}}},promptAsync:async()=>({data:{}}),diff:async()=>({data:[]}),abort:async()=>({data:true})}}
  const resources=options.resources??new Set(),ensure=options.ensureBrowser
  return new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:1,providers:{p:1},models:{'p/code':1}})),process.cwd(),process.cwd(),()=>resolveHiConfig({routing:{roleModels:{coder:['p/code'],visualQa:['p/code']}}}),()=>[{id:'p/code',provider:'p',writeCapable:true,visionCapable:true,tags:['coding','balanced','vision']}],()=>({}),undefined,[],undefined,undefined,()=>resources,undefined,ensure)
}

test('ablation: accepted sessionless queued task survives restart as pending work instead of becoming failed/blocked',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'durable-queue-ablation','two independent implementation streams',{scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation'],likely_verification:[]})
  m.execution.execution_mode='parallel';m.execution.topology={mode:'multi-agent',parallelism:2,reason:['ablation']}
  const rt=runtime(),first=await rt.start(m,{objective:'first',role:'coder',scope:['src/a.ts'],requiredEvidence:[]}),second=await rt.start(m,{objective:'second',role:'coder',scope:['src/b.ts'],requiredEvidence:[]})
  assert.equal(first.readiness,'READY');assert.equal(second.readiness,'WAIT');assert.equal(rt.queueDepth(),1)
  const source=structuredClone(m),queuedTask=source.execution.tasks.find(t=>t.id===second.task_id),queuedWorker=source.execution.workers.find(w=>w.id===second.worker_id)
  assert.equal(queuedTask.status,'queued');assert.equal(queuedWorker.status,'queued');assert.equal(queuedWorker.session_id,undefined);assert.ok(queuedTask.execution_profile)
  const restored=new MissionStore();restored.restore([source],false);const after=restored.get('durable-queue-ablation')
  const task=after.execution.tasks.find(t=>t.id===second.task_id),worker=after.execution.workers.find(w=>w.id===second.worker_id)
  assert.equal(task.status,'queued','accepted queued work should remain pending across restart')
  assert.equal(worker.status,'queued','worker identity should remain queued across restart')
  assert.equal(task.id,second.task_id);assert.equal(worker.id,second.worker_id)
})


test('ablation: durable queued recipe rehydrates and dispatches the exact existing Task/Worker identity',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'durable-queue-dispatch','two independent implementation streams',{scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation'],likely_verification:[]})
  m.execution.execution_mode='parallel';m.execution.topology={mode:'multi-agent',parallelism:2,reason:['ablation']}
  const original=runtime(),first=await original.start(m,{objective:'first',role:'coder',scope:['src/a.ts'],requiredEvidence:[]}),second=await original.start(m,{objective:'second',role:'coder',scope:['src/b.ts'],requiredEvidence:[]})
  assert.equal(first.readiness,'READY');assert.equal(second.readiness,'WAIT')
  const source=structuredClone(m)
  source.execution.tasks=source.execution.tasks.filter(t=>t.id===second.task_id)
  source.execution.workers=source.execution.workers.filter(w=>w.id===second.worker_id)
  source.execution.scheduler.reservations=[]
  const restored=new MissionStore();restored.restore([source],false);const after=restored.get('durable-queue-dispatch'),created=[],next=runtime(created)
  const beforeTask=after.execution.tasks[0],beforeWorker=after.execution.workers[0]
  assert.equal(next.rehydrateQueued(after),1);assert.equal(next.queueDepth(),1)
  await new Promise(resolve=>setImmediate(resolve))
  const task=after.execution.tasks.find(t=>t.id===second.task_id),worker=after.execution.workers.find(w=>w.id===second.worker_id)
  assert.equal(task,beforeTask);assert.equal(worker,beforeWorker)
  assert.equal(task.status,'running');assert.equal(worker.status,'busy');assert.equal(worker.session_id,'child-1')
  assert.deepEqual(created,['child-1']);assert.equal(next.queueDepth(),0)
  assert.ok(after.execution.ledger.some(e=>e.type==='worker.restart-queue-rehydrated'&&e.task_id===second.task_id&&e.worker_id===second.worker_id))
})


test('lifecycle: waiting-user preserves restored queue and active transition wakes the same durable work',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'durable-queue-human-gate','two streams',{scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation'],likely_verification:[]})
  m.execution.execution_mode='parallel';m.execution.topology={mode:'multi-agent',parallelism:2,reason:['ablation']}
  const original=runtime(),first=await original.start(m,{objective:'first',role:'coder',scope:['src/a.ts'],requiredEvidence:[]}),second=await original.start(m,{objective:'second',role:'coder',scope:['src/b.ts'],requiredEvidence:[]})
  assert.equal(first.readiness,'READY');assert.equal(second.readiness,'WAIT')
  const source=structuredClone(m);source.execution.tasks=source.execution.tasks.filter(t=>t.id===second.task_id);source.execution.workers=source.execution.workers.filter(w=>w.id===second.worker_id);source.execution.scheduler.reservations=[]
  const restored=new MissionStore();restored.restore([source],false);const after=restored.get('durable-queue-human-gate'),created=[],next=runtime(created)
  after.identity.status='waiting-user'
  assert.equal(next.rehydrateQueued(after),1);await new Promise(resolve=>setImmediate(resolve))
  assert.equal(next.queueDepth(),1);assert.deepEqual(created,[]);assert.equal(after.execution.tasks[0].status,'queued');assert.equal(after.execution.workers[0].status,'queued')
  after.identity.status='active';next.wakeQueued();await new Promise(resolve=>setImmediate(resolve))
  assert.equal(next.queueDepth(),0);assert.deepEqual(created,['child-1']);assert.equal(after.execution.tasks[0].status,'running');assert.equal(after.execution.workers[0].status,'busy')
})

test('lifecycle: restored bounded-playwright queue waits for live browser resource before child dispatch',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'durable-queue-browser-gate','two streams',{scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation'],likely_verification:[]})
  m.execution.execution_mode='parallel';m.execution.topology={mode:'multi-agent',parallelism:2,reason:['ablation']}
  const original=runtime(),first=await original.start(m,{objective:'first',role:'coder',scope:['src/a.ts'],requiredEvidence:[]}),second=await original.start(m,{objective:'second',role:'coder',scope:['src/b.ts'],requiredEvidence:[]})
  assert.equal(first.readiness,'READY');assert.equal(second.readiness,'WAIT')
  const source=structuredClone(m);source.execution.tasks=source.execution.tasks.filter(t=>t.id===second.task_id);source.execution.workers=source.execution.workers.filter(w=>w.id===second.worker_id);source.execution.scheduler.reservations=[]
  const task=source.execution.tasks[0],worker=source.execution.workers[0];task.role='visual-qa';worker.role='visual-qa';task.execution_profile.role='visual-qa';task.execution_profile.browser_backend='bounded-playwright';task.requiredEvidence=['visual-check'];task.execution_profile.task.required_evidence=['visual-check']
  const restored=new MissionStore();restored.restore([source],false);const after=restored.get('durable-queue-browser-gate'),created=[],resources=new Set(),next=runtime(created,{resources,ensureBrowser:async()=>({available:resources.has('host-capability:browser-execution'),attempted:true,reason:'test-browser-unavailable'})})
  assert.equal(next.rehydrateQueued(after),1);await new Promise(resolve=>setImmediate(resolve))
  assert.equal(next.queueDepth(),1);assert.deepEqual(created,[]);assert.ok(after.execution.blockers.includes('capability-unavailable:browser-execution'))
  resources.add('host-capability:browser-execution');next.wakeQueued();await new Promise(resolve=>setImmediate(resolve))
  assert.equal(next.queueDepth(),0);assert.deepEqual(created,['child-1']);assert.equal(after.execution.tasks[0].status,'running');assert.equal(after.execution.workers[0].status,'busy');assert.equal(after.execution.blockers.includes('capability-unavailable:browser-execution'),false)
})


test('ablation: non-material follow-up does not discard an accepted sessionless queued task',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'durable-queue-nonmaterial','two independent implementation streams',{scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation'],likely_verification:[]})
  m.execution.execution_mode='parallel';m.execution.topology={mode:'multi-agent',parallelism:2,reason:['ablation']}
  const created=[],rt=runtime(created),first=await rt.start(m,{objective:'first',role:'coder',scope:['src/a.ts'],requiredEvidence:[]}),second=await rt.start(m,{objective:'second',role:'coder',scope:['src/b.ts'],requiredEvidence:[]})
  assert.equal(first.readiness,'READY');assert.equal(second.readiness,'WAIT');assert.equal(rt.queueDepth(),1)
  const queuedTask=m.execution.tasks.find(t=>t.id===second.task_id),queuedWorker=m.execution.workers.find(w=>w.id===second.worker_id)
  store.beginFollowupSemanticAssessment(m.identity.session_id,'thanks')
  assert.equal(await rt.pauseForSemanticAssessment(m),2)
  assert.equal(queuedTask.status,'queued','semantic quarantine should retain accepted queued work until follow-up meaning is known')
  assert.equal(queuedWorker.status,'queued')
  store.applyFollowupSemanticAssessment(m.identity.session_id,{material:false,message_kind:'non-material',task_kind:'implementation',scope:'multi-stream',risk:'low',ambiguity:'none',dependency_class:'independent-multi',required_capabilities:[],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]})
  await rt.resumeAfterSemanticAssessment(m,'non-material')
  rt.applyResult(m,first.worker_id,{status:'DONE',summary:'first done',changed_files:[],evidence:[],open_issues:[],needs_context:[]})
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(queuedTask.status,'running');assert.equal(queuedWorker.status,'busy');assert.equal(queuedWorker.id,second.worker_id);assert.equal(created.length,2)
})


test('safety: material verification follow-up still invalidates a sessionless queued recipe before dispatch',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'durable-queue-material-followup','two independent implementation streams',{scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation'],likely_verification:[]})
  m.execution.execution_mode='parallel';m.execution.topology={mode:'multi-agent',parallelism:2,reason:['ablation']}
  const created=[],rt=runtime(created),first=await rt.start(m,{objective:'first',role:'coder',scope:['src/a.ts'],requiredEvidence:[]}),second=await rt.start(m,{objective:'second',role:'coder',scope:['src/b.ts'],requiredEvidence:[]})
  const queuedTask=m.execution.tasks.find(t=>t.id===second.task_id),queuedWorker=m.execution.workers.find(w=>w.id===second.worker_id)
  store.beginFollowupSemanticAssessment(m.identity.session_id,'verify with targeted tests')
  await rt.pauseForSemanticAssessment(m);assert.equal(queuedWorker.status,'queued')
  store.applyFollowupSemanticAssessment(m.identity.session_id,{material:true,message_kind:'verification',task_kind:'implementation',scope:'multi-stream',risk:'low',ambiguity:'none',dependency_class:'independent-multi',required_capabilities:['verification'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]})
  await rt.resumeAfterSemanticAssessment(m,'verification')
  assert.equal(queuedTask.status,'cancelled');assert.equal(queuedWorker.status,'cancelled');assert.equal(rt.queueDepth(),0);assert.equal(created.length,1)
  assert.equal(m.execution.workers.find(w=>w.id===first.worker_id)?.status,'busy')
})
