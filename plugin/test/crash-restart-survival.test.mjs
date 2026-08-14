import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { createTask, createWorker } from '../dist/runtime/worker/worker-runtime.js'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { ConcurrencyScheduler } from '../dist/runtime/scheduler/concurrency.js'
import { resolveHiConfig } from '../dist/config/resolver.js'

function persistedBusy({session=true}={}){
  const store=new MissionStore()
  const m=store.start('parent-1','fix local bug')
  store.applyInitialSemanticAssessment('parent-1',{material:true,message_kind:'mission',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]})
  const impl=m.obligations.find(o=>o.kind==='implementation')
  const task=createTask(m,{objective:m.objective,role:'coder',category:'quick',scope:[],constraints:[],dependencies:[],requiredEvidence:m.intent.likelyVerification,obligationIds:impl?[impl.id]:[]})
  const worker=createWorker(m,task,'host-default',[],[],[])
  worker.status='busy'; worker.started_at=Date.now()-1000
  if(session)worker.session_id='child-old'
  task.status='running'
  m.pending_permissions=2;m.pending_permission_ids=['p1','p2']
  m.evidence.fresh=true;m.evidence.items=[{id:'e1',kind:'targeted-tests',summary:'pass before crash',scope:[],source:'worker',observed_at:Date.now()-500,pass:true,outcome:'passed'}]
  return structuredClone(m)
}

test('unclean restart quarantines in-flight child, resets ephemeral permission wait, and invalidates evidence',()=>{
  const restored=new MissionStore(); restored.restore([persistedBusy()],true)
  const m=restored.get('parent-1'); assert.ok(m)
  const w=m.workers[0],t=m.tasks[0]
  assert.equal(w.status,'ready')
  assert.equal(w.restart_reconcile_pending,true)
  assert.equal(w.session_id,'child-old')
  assert.equal(t.status,'waiting')
  assert.equal(t.result?.status,'NEEDS_CONTEXT')
  assert.deepEqual(t.result?.needs_context,['runtime-restart-reconcile'])
  assert.equal(m.pending_permissions,0)
  assert.deepEqual(m.pending_permission_ids,[])
  assert.equal(m.evidence.fresh,false)
  assert.ok(m.evidence.items[0].invalidated_at)
  assert.ok(m.ledger.some(e=>e.type==='permission.crash-reset'))
  assert.ok(m.ledger.some(e=>e.type==='evidence.crash-invalidated'))
})

test('restart without an established child session allows a fresh bounded worker instead of deadlocking a ready worker',()=>{
  const restored=new MissionStore(); restored.restore([persistedBusy({session:false})],true)
  const m=restored.get('parent-1'); assert.ok(m)
  assert.equal(m.workers[0].status,'failed')
  assert.equal(m.tasks[0].status,'blocked')
  assert.equal(m.tasks[0].result?.status,'BLOCKED')
  assert.deepEqual(m.tasks[0].result?.needs_context,['runtime-restart-fresh-worker'])
})

test('explicit task restart reuses the quarantined child session and only then unlocks its callbacks',async()=>{
  const restored=new MissionStore(); restored.restore([persistedBusy()],true)
  const m=restored.get('parent-1'); assert.ok(m)
  const calls=[]
  const client={session:{prompt_async:async body=>{calls.push(body)}}}
  const registry=new BackgroundRegistry(); for(const w of m.workers)registry.set(w)
  const scheduler=new ConcurrencyScheduler(()=>({global:2}))
  const runtime=new TaskRuntime(client,registry,scheduler,process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>({}))
  const old=m.workers[0]
  const out=await runtime.start(m,{objective:m.objective,role:'coder',category:'quick',scope:[],dependencies:[],requiredEvidence:m.intent.likelyVerification,obligationIds:m.tasks[0].obligation_ids})
  assert.equal(out.worker_id,old.id)
  assert.equal(out.session_id,'child-old')
  assert.equal(m.workers[0].status,'busy')
  assert.equal(m.workers[0].restart_reconcile_pending,false)
  assert.equal(m.tasks[0].status,'running')
  assert.equal(calls.length,1)
  assert.match(JSON.stringify(calls[0]),/corrective resume|runtime-restart-reconcile/i)
})


test('process-ephemeral team projection resets to single without replacing durable task worker obligation or evidence identity',()=>{
  const source=persistedBusy(),task2=structuredClone(source.tasks[0]),worker2=structuredClone(source.workers[0])
  task2.id='team-task-2';task2.worker_id='team-worker-2';task2.objective='second team perspective'
  worker2.id='team-worker-2';worker2.task_id=task2.id;worker2.fingerprint='team-worker-2';worker2.session_id='child-team-2'
  source.tasks.push(task2);source.workers.push(worker2);source.execution_mode='team'
  const taskIDs=source.tasks.map(x=>x.id),workerIDs=source.workers.map(x=>x.id),obligationIDs=source.obligations.map(x=>x.id),evidenceIDs=source.evidence.items.map(x=>x.id)
  const restored=new MissionStore();restored.restore([source],false)
  const m=restored.get('parent-1');assert.ok(m)
  assert.equal(m.execution_mode,'single')
  assert.deepEqual(m.tasks.map(x=>x.id),taskIDs)
  assert.deepEqual(m.workers.map(x=>x.id),workerIDs)
  assert.deepEqual(m.obligations.map(x=>x.id),obligationIDs)
  assert.deepEqual(m.evidence.items.map(x=>x.id),evidenceIDs)
  assert.equal(m.evidence.fresh,true)
  assert.ok(m.workers.every(x=>x.status==='ready'&&x.restart_reconcile_pending===true))
  assert.ok(m.tasks.every(x=>x.status==='waiting'&&x.result?.status==='NEEDS_CONTEXT'))
  const reset=m.ledger.find(x=>x.type==='team.projection-reset')
  assert.ok(reset)
  assert.equal(reset.payload.reason,'process-ephemeral-team-runtime')
  assert.deepEqual(reset.payload.durable_tasks,taskIDs)
  assert.deepEqual(reset.payload.durable_workers,workerIDs)
})
