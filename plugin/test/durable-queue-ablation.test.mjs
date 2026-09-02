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


test('queued recipe is invalidated before dispatch when an earlier canonical owner settles FIX_REQUIRED',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'durable-queue-owner-race','one canonical implementation obligation with queued follow-up',{scope:'local',dependency_class:'independent',required_capabilities:['implementation'],likely_verification:[]})
  const created=[],rt=runtime(created),first=await rt.start(m,{objective:'run service owner',role:'coder',scope:['src/a.ts'],requiredEvidence:[]}),second=await rt.start(m,{objective:'queued replacement',role:'coder',scope:['src/b.ts'],requiredEvidence:[]})
  assert.equal(first.readiness,'READY');assert.equal(second.readiness,'WAIT');assert.equal(rt.queueDepth(),1);assert.deepEqual(created,['child-1'])
  const firstTask=m.execution.tasks.find(t=>t.id===first.task_id),firstWorker=m.execution.workers.find(w=>w.id===first.worker_id),queuedTask=m.execution.tasks.find(t=>t.id===second.task_id),queuedWorker=m.execution.workers.find(w=>w.id===second.worker_id)
  assert.deepEqual(firstTask.obligation_ids,queuedTask.obligation_ids)
  rt.applyResult(m,first.worker_id,{status:'FIX_REQUIRED',summary:'canonical correction remains',changed_files:[],scope_expansions:[],evidence:[],open_issues:['worker-result-contract-invalid'],needs_context:[]})
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(firstTask.status,'waiting');assert.equal(firstWorker.status,'ready');assert.equal(queuedTask.status,'cancelled');assert.equal(queuedWorker.status,'cancelled');assert.equal(rt.queueDepth(),0);assert.deepEqual(created,['child-1'])
  const invalidated=m.execution.ledger.findLast(e=>e.type==='worker.queue-reconcile-invalidated'&&e.task_id===second.task_id);assert.equal(invalidated?.payload?.owner_task_id,first.task_id);assert.equal(invalidated?.payload?.owner_status,'FIX_REQUIRED');assert.deepEqual(invalidated?.payload?.overlapping_obligations,firstTask.obligation_ids)
  const resumed=await rt.resume(m,first.task_id);assert.equal(resumed.task_id,first.task_id);assert.equal(resumed.worker_id,first.worker_id);assert.equal(firstWorker.status,'busy');assert.equal(created.length,1,'same-session correction must win instead of spawning queued replacement')
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


test('exact task_id resume preserves an accepted sessionless queued Task/Worker instead of requiring a host session or replacement',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'durable-queue-exact-resume','two independent implementation streams',{scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation'],likely_verification:[]})
  m.execution.execution_mode='parallel';m.execution.topology={mode:'multi-agent',parallelism:2,reason:['ablation']}
  const created=[],rt=runtime(created),first=await rt.start(m,{objective:'first',role:'coder',scope:['src/a.ts'],requiredEvidence:[]}),second=await rt.start(m,{objective:'second',role:'coder',scope:['src/b.ts'],requiredEvidence:[]})
  assert.equal(first.readiness,'READY');assert.equal(second.readiness,'WAIT');assert.deepEqual(created,['child-1'])
  const task=m.execution.tasks.find(t=>t.id===second.task_id),worker=m.execution.workers.find(w=>w.id===second.worker_id);assert.ok(task&&worker);assert.equal(worker.session_id,undefined)
  const resumed=await rt.resume(m,second.task_id)
  assert.equal(resumed.task_id,second.task_id);assert.equal(resumed.worker_id,second.worker_id);assert.equal(resumed.readiness,'WAIT');assert.match(resumed.selection_reason.join(' '),/exact-identity-rehydrated/)
  assert.equal(m.execution.tasks.filter(t=>t.id===second.task_id).length,1);assert.equal(m.execution.workers.filter(w=>w.id===second.worker_id).length,1)
  rt.applyResult(m,first.worker_id,{status:'DONE',summary:'first done',changed_files:[],evidence:[],open_issues:[],needs_context:[]})
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(task.status,'running');assert.equal(worker.status,'busy');assert.equal(worker.session_id,'child-2');assert.deepEqual(created,['child-1','child-2'])
})

test('explicit compatible role owns an owner-ambiguous verification obligation and preserves obligation evidence',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'verification-role-owner','fix bounded bug',{scope:'multi-file',dependency_class:'sequential',required_capabilities:['implementation','verification'],likely_verification:['changed-surface-sanity']})
  for(const o of m.execution.obligations)if(o.kind!=='verification'){o.status='closed';o.closedAt=Date.now()}
  const verification=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(verification);verification.status='open';verification.requiredEvidence=['changed-surface-sanity']
  const created=[],rt=runtime(created)
  const started=await rt.start(m,{objective:'run existing verification only',role:'test-engineer',scope:['src/a.ts'],requiredEvidence:['changed-surface-sanity'],obligationIds:[verification.id]})
  const task=m.execution.tasks.find(t=>t.id===started.task_id);assert.ok(task)
  assert.equal(task.role,'test-engineer');assert.deepEqual(task.obligation_ids,[verification.id]);assert.deepEqual(task.requiredEvidence,['changed-surface-sanity']);assert.equal(task.requiredEvidenceOrigin,'explicit')
  assert.notEqual(task.role,'repository-explorer')
})
