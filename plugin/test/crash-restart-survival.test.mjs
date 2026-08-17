import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { createTask, createWorker } from '../dist/runtime/worker/worker-runtime.js'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { ConcurrencyScheduler } from '../dist/runtime/scheduler/concurrency.js'
import { resolveHiConfig } from '../dist/config/resolver.js'
import {opencodeChildPort} from './helpers/host-port.mjs'
import {executionAttemptIdentity} from '../dist/contracts/orchestration-core.js'
import {reduceSchedulerLifecycle} from '../dist/runtime/scheduler/lifecycle.js'

function persistedBusy({session=true}={}){
  const store=new MissionStore()
  const m=store.start('parent-1','fix local bug')
  store.applyInitialSemanticAssessment('parent-1',{material:true,message_kind:'mission',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]})
  const impl=m.execution.obligations.find(o=>o.kind==='implementation')
  const task=createTask(m,{objective:m.identity.objective,role:'coder',category:'quick',scope:[],constraints:[],dependencies:[],requiredEvidence:m.identity.intent.likelyVerification,obligationIds:impl?[impl.id]:[]})
  const worker=createWorker(m,task,'host-default',[],[],[])
  worker.status='busy'; worker.started_at=Date.now()-1000
  if(session)worker.session_id='child-old'
  task.status='running'
  m.authority.pending_permissions=2;m.authority.pending_permission_ids=['p1','p2']
  m.execution.evidence.fresh=true;m.execution.evidence.items=[{id:'e1',kind:'targeted-tests',summary:'pass before crash',scope:[],source:'worker',observed_at:Date.now()-500,pass:true,outcome:'passed'}]
  return structuredClone(m)
}

function persistedBusyWithReservation({session=true}={}){
  const m=persistedBusy({session}),worker=m.execution.workers[0],task=m.execution.tasks[0]
  worker.status=session?'busy':'starting';task.status=session?'running':'queued';worker.attempt=session?1:0
  const attempt=executionAttemptIdentity({executionUnitId:`eu:${task.id}`,workerId:worker.id,ordinal:1,generation:m.continuation.generation})
  let transition=reduceSchedulerLifecycle(m.execution.scheduler,{type:'RESERVE',missionId:m.identity.mission_id,workNodeId:task.id,workerId:worker.id,attempt,resource:{},at:10})
  assert.equal(transition.accepted,true);m.execution.scheduler=transition.state
  if(session){transition=reduceSchedulerLifecycle(m.execution.scheduler,{type:'HOST_BOUND',reservationId:transition.reservation.reservationId,attempt,hostExecutionId:worker.session_id,at:11});assert.equal(transition.accepted,true);m.execution.scheduler=transition.state}
  return m
}

test('unclean restart quarantines in-flight child, resets ephemeral permission wait, and invalidates evidence',()=>{
  const restored=new MissionStore(); restored.restore([persistedBusy()],true)
  const m=restored.get('parent-1'); assert.ok(m)
  const w=m.execution.workers[0],t=m.execution.tasks[0]
  assert.equal(w.status,'ready')
  assert.equal(w.restart_reconcile_pending,true)
  assert.equal(w.session_id,'child-old')
  assert.equal(t.status,'waiting')
  assert.equal(t.result?.status,'NEEDS_CONTEXT')
  assert.deepEqual(t.result?.needs_context,['runtime-restart-reconcile'])
  assert.equal(m.authority.pending_permissions,0)
  assert.deepEqual(m.authority.pending_permission_ids,[])
  assert.equal(m.execution.evidence.fresh,false)
  assert.ok(m.execution.evidence.items[0].invalidated_at)
  assert.ok(m.execution.ledger.some(e=>e.type==='permission.crash-reset'))
  assert.ok(m.execution.ledger.some(e=>e.type==='evidence.crash-invalidated'))
})

test('restart without an established child session allows a fresh bounded worker instead of deadlocking a ready worker',()=>{
  const restored=new MissionStore(); restored.restore([persistedBusy({session:false})],true)
  const m=restored.get('parent-1'); assert.ok(m)
  assert.equal(m.execution.workers[0].status,'failed')
  assert.equal(m.execution.tasks[0].status,'blocked')
  assert.equal(m.execution.tasks[0].result?.status,'BLOCKED')
  assert.deepEqual(m.execution.tasks[0].result?.needs_context,['runtime-restart-fresh-worker'])
})

test('explicit task restart quiesces and reconciles the durable reservation before the next same-session attempt',async()=>{
  const restored=new MissionStore(); restored.restore([persistedBusyWithReservation()],true)
  const m=restored.get('parent-1'); assert.ok(m)
  assert.equal(m.execution.scheduler.reservations.length,1);assert.equal(m.execution.scheduler.reservations[0].phase,'RECONCILING')
  const calls=[],aborts=[]
  const client={session:{abort:async req=>{aborts.push(req)},prompt_async:async body=>{calls.push(body)}}}
  const registry=new BackgroundRegistry(); for(const w of m.execution.workers)registry.set(w)
  const scheduler=new ConcurrencyScheduler(()=>({global:2}))
  const runtime=new TaskRuntime(opencodeChildPort(client),registry,scheduler,process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>({}))
  const old=m.execution.workers[0]
  const out=await runtime.start(m,{objective:m.identity.objective,role:'coder',category:'quick',scope:[],dependencies:[],requiredEvidence:m.identity.intent.likelyVerification,obligationIds:m.execution.tasks[0].obligation_ids})
  assert.equal(out.worker_id,old.id);assert.equal(out.session_id,'child-old')
  assert.equal(aborts.length,1,'old in-flight host run must be quiesced before a new attempt is admitted')
  assert.equal(m.execution.workers[0].attempt,2);assert.equal(m.execution.workers[0].restart_reconcile_pending,false)
  assert.equal(m.execution.tasks[0].status,'running');assert.equal(calls.length,1)
  assert.equal(m.execution.scheduler.reservations.length,1,'old reservation must be replaced, not leaked alongside the new attempt')
  const reservation=m.execution.scheduler.reservations[0];assert.equal(reservation.phase,'RUNNING');assert.equal(reservation.attempt.ordinal,2);assert.equal(reservation.hostExecutionId,'child-old')
  assert.ok(m.execution.ledger.some(e=>e.type==='scheduler.restart-reconciled'&&e.payload?.outcome==='terminal-aborted-before-resume'))
  assert.match(JSON.stringify(calls[0]),/corrective resume|runtime-restart-reconcile/i)
})

test('restart before host creation reconciles pre-spawn reservation as NOT_STARTED without leaking capacity',()=>{
  const restored=new MissionStore();restored.restore([persistedBusyWithReservation({session:false})],true)
  const m=restored.get('parent-1');assert.ok(m)
  assert.equal(m.execution.workers[0].status,'failed');assert.equal(m.execution.tasks[0].status,'blocked')
  assert.deepEqual(m.execution.scheduler.reservations,[])
  assert.ok(m.execution.ledger.some(e=>e.type==='scheduler.restart-reconciled'&&e.payload?.outcome==='not-started'))
})


test('process-ephemeral team projection resets to single without replacing durable task worker obligation or evidence identity',()=>{
  const source=persistedBusy(),task2=structuredClone(source.execution.tasks[0]),worker2=structuredClone(source.execution.workers[0])
  task2.id='team-task-2';task2.worker_id='team-worker-2';task2.objective='second team perspective'
  worker2.id='team-worker-2';worker2.task_id=task2.id;worker2.fingerprint='team-worker-2';worker2.session_id='child-team-2'
  source.execution.tasks.push(task2);source.execution.workers.push(worker2);source.execution.execution_mode='team'
  const taskIDs=source.execution.tasks.map(x=>x.id),workerIDs=source.execution.workers.map(x=>x.id),obligationIDs=source.execution.obligations.map(x=>x.id),evidenceIDs=source.execution.evidence.items.map(x=>x.id)
  const restored=new MissionStore();restored.restore([source],false)
  const m=restored.get('parent-1');assert.ok(m)
  assert.equal(m.execution.execution_mode,'single')
  assert.deepEqual(m.execution.tasks.map(x=>x.id),taskIDs)
  assert.deepEqual(m.execution.workers.map(x=>x.id),workerIDs)
  assert.deepEqual(m.execution.obligations.map(x=>x.id),obligationIDs)
  assert.deepEqual(m.execution.evidence.items.map(x=>x.id),evidenceIDs)
  assert.equal(m.execution.evidence.fresh,true)
  assert.ok(m.execution.workers.every(x=>x.status==='ready'&&x.restart_reconcile_pending===true))
  assert.ok(m.execution.tasks.every(x=>x.status==='waiting'&&x.result?.status==='NEEDS_CONTEXT'))
  const reset=m.execution.ledger.find(x=>x.type==='team.projection-reset')
  assert.ok(reset)
  assert.equal(reset.payload.reason,'process-ephemeral-team-runtime')
  assert.deepEqual(reset.payload.durable_tasks,taskIDs)
  assert.deepEqual(reset.payload.durable_workers,workerIDs)
})
