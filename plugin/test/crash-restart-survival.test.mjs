import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { createTask, createWorker } from '../dist/runtime/worker/worker-runtime.js'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { createConcurrencyPolicySource } from '../dist/runtime/scheduler/concurrency.js'
import { resolveHiConfig } from '../dist/config/resolver.js'
import {opencodeChildPort} from './helpers/host-port.mjs'
import {executionAttemptIdentity} from '../dist/contracts/orchestration-core.js'
import {reduceSchedulerLifecycle} from '../dist/runtime/scheduler/lifecycle.js'

function persistedBusy({session=true}={}){
  const store=new MissionStore()
  const m=store.start('parent-1','fix local bug')
  store.applyInitialSemanticAssessment('parent-1',{material:true,message_kind:'mission',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]})
  const impl=m.execution.obligations.find(o=>o.kind==='implementation')
  const task=createTask(m,{objective:m.identity.objective,role:'coder',category:'quick',scope:['src/a.ts'],constraints:[],dependencies:[],requiredEvidence:m.identity.intent.likelyVerification,obligationIds:impl?[impl.id]:[]})
  const worker=createWorker(m,task,'host-default',[],[],[])
  worker.status='busy'; worker.started_at=Date.now()-1000
  if(session)worker.session_id='child-old'
  task.status='running'
  m.authority.pending_permissions=2;m.authority.pending_permission_ids=['p1','p2']
  m.execution.evidence.fresh=true;m.execution.evidence.items=[{id:'e1',kind:'targeted-tests',summary:'pass before crash',scope:['src/a.ts'],source:'worker',observed_at:Date.now()-500,pass:true,outcome:'passed'}]
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

function restartHarness(m,{status='unknown',assistant}={}){
  const calls={aborts:[],prompts:[],reads:0}
  const statusMap=status==='idle'?{}:{'child-old':{type:status==='unknown'?'mystery':status}}
  const client={session:{
    status:async()=>({data:statusMap}),
    abort:async req=>{calls.aborts.push(req);return{data:true}},
    promptAsync:async req=>{calls.prompts.push(req);return{data:{}}},
    diff:async()=>({data:[]}),
  }}
  const registry=new BackgroundRegistry();for(const w of m.execution.workers)registry.set(w)
  const scheduler=createConcurrencyPolicySource(()=>({global:2}))
  const reader=assistant===undefined?undefined:async()=>{calls.reads++;return assistant}
  const runtime=new TaskRuntime(opencodeChildPort(client),registry,scheduler,process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>({}),undefined,[],undefined,undefined,undefined,undefined,undefined,reader)
  return{runtime,registry,scheduler,calls}
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

test('restart observes live host-active child and waits without aborting or dispatching a duplicate prompt',async()=>{
  const restored=new MissionStore();restored.restore([persistedBusyWithReservation()],true)
  const m=restored.get('parent-1');assert.ok(m)
  const {runtime,calls}=restartHarness(m,{status:'busy'}),old=m.execution.workers[0]
  const out=await runtime.start(m,{objective:m.identity.objective,role:'coder',category:'quick',scope:['src/a.ts'],dependencies:[],requiredEvidence:m.identity.intent.likelyVerification,obligationIds:m.execution.tasks[0].obligation_ids})
  assert.equal(out.worker_id,old.id);assert.equal(out.readiness,'WAIT');assert.equal(calls.aborts.length,0);assert.equal(calls.prompts.length,0)
  assert.equal(old.attempt,1);assert.equal(old.status,'busy');assert.equal(old.restart_reconcile_pending,false);assert.equal(m.execution.tasks[0].status,'running')
  const reservation=m.execution.scheduler.reservations[0];assert.equal(reservation.phase,'RUNNING');assert.equal(reservation.attempt.ordinal,1);assert.equal(reservation.hostExecutionId,'child-old')
  assert.ok(m.execution.ledger.some(e=>e.type==='scheduler.restart-reconciled'&&e.payload?.outcome==='host-active'))
})

test('restart recovers a stable stale empty assistant successor by aborting only that turn and resuming the same session for structured result',async()=>{
  const restored=new MissionStore();restored.restore([persistedBusyWithReservation()],true)
  const m=restored.get('parent-1');assert.ok(m);const old=m.execution.workers[0],now=Date.now();old.attempt_prompt_message_id='msg-user-attempt-1';old.started_at=now-120_000
  const assistant={text:'prior completed observations',model:{model:'p/m',message_id:'msg-open-empty',parent_id:'msg-user-attempt-1',created_at:now-60_000},activity:{message_id:'msg-completed-tools',observed_at:now-61_000,output_tokens:10,reasoning_tokens:0,tool_calls:3,text_chars:40},incomplete_turn:{message_id:'msg-open-empty',parent_id:'msg-user-attempt-1',created_at:now-60_000,empty:true}}
  const {runtime,calls}=restartHarness(m,{status:'busy',assistant})
  const out=await runtime.start(m,{objective:m.identity.objective,role:'coder',category:'quick',scope:['src/a.ts'],dependencies:[],requiredEvidence:m.identity.intent.likelyVerification,obligationIds:m.execution.tasks[0].obligation_ids})
  assert.equal(out.worker_id,old.id);assert.equal(out.readiness,'READY');assert.equal(calls.reads,2);assert.equal(calls.aborts.length,1);assert.equal(calls.prompts.length,1)
  assert.equal(old.session_id,'child-old');assert.equal(old.attempt,2);assert.equal(old.status,'busy');assert.equal(old.restart_reconcile_pending,false);assert.equal(m.execution.tasks[0].status,'running')
  assert.equal(m.execution.scheduler.reservations.length,1);assert.equal(m.execution.scheduler.reservations[0].phase,'RUNNING');assert.equal(m.execution.scheduler.reservations[0].attempt.ordinal,2)
  assert.match(JSON.stringify(calls.prompts[0]),/restart-incomplete-terminal-turn/);assert.match(JSON.stringify(calls.prompts[0]),/do not repeat completed external\/browser\/process actions/i)
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.restart-incomplete-turn.recovered'&&e.payload?.incomplete_message_id==='msg-open-empty'))
})

test('restart leaves a fresh empty assistant turn host-active and does not abort a potentially live execution',async()=>{
  const restored=new MissionStore();restored.restore([persistedBusyWithReservation()],true)
  const m=restored.get('parent-1');assert.ok(m);const old=m.execution.workers[0],now=Date.now();old.attempt_prompt_message_id='msg-user-attempt-1';old.started_at=now-5000
  const assistant={model:{model:'p/m',message_id:'msg-open-empty',parent_id:'msg-user-attempt-1',created_at:now-1000},activity:{message_id:'msg-completed-tools',observed_at:now-2000,output_tokens:10,reasoning_tokens:0,tool_calls:1,text_chars:10},incomplete_turn:{message_id:'msg-open-empty',parent_id:'msg-user-attempt-1',created_at:now-1000,empty:true}}
  const {runtime,calls}=restartHarness(m,{status:'busy',assistant})
  const out=await runtime.start(m,{objective:m.identity.objective,role:'coder',category:'quick',scope:['src/a.ts'],dependencies:[],requiredEvidence:m.identity.intent.likelyVerification,obligationIds:m.execution.tasks[0].obligation_ids})
  assert.equal(out.readiness,'WAIT');assert.equal(calls.reads,1);assert.equal(calls.aborts.length,0);assert.equal(calls.prompts.length,0);assert.equal(old.attempt,1);assert.equal(old.status,'busy')
})

test('restart ingests an idle completed attempt and does not repeat already-finished work',async()=>{
  const restored=new MissionStore();restored.restore([persistedBusyWithReservation()],true)
  const m=restored.get('parent-1');assert.ok(m)
  const assistant={text:JSON.stringify({status:'DONE',summary:'completed before restart',changed_files:[],evidence:[],open_issues:[],needs_context:[]})}
  const {runtime,calls}=restartHarness(m,{status:'idle',assistant}),old=m.execution.workers[0]
  const out=await runtime.start(m,{objective:m.identity.objective,role:'coder',category:'quick',scope:['src/a.ts'],dependencies:[],requiredEvidence:m.identity.intent.likelyVerification,obligationIds:m.execution.tasks[0].obligation_ids})
  assert.equal(out.worker_id,old.id);assert.equal(out.readiness,'READY');assert.equal(calls.reads,1);assert.equal(calls.aborts.length,0);assert.equal(calls.prompts.length,0)
  assert.equal(old.attempt,1);assert.equal(old.status,'completed');assert.equal(old.restart_reconcile_pending,false);assert.equal(m.execution.tasks[0].status,'completed');assert.equal(m.execution.tasks[0].result?.summary,'completed before restart')
  assert.equal(m.execution.scheduler.reservations.length,0,'recovered terminal attempt must release its durable reservation exactly once')
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.restart-result-recovered'&&e.payload?.result==='DONE'))
})

test('restart opens attempt 2 only after an idle FIX_REQUIRED result is ingested from attempt 1',async()=>{
  const restored=new MissionStore();restored.restore([persistedBusyWithReservation()],true)
  const m=restored.get('parent-1');assert.ok(m)
  const assistant={text:JSON.stringify({status:'FIX_REQUIRED',summary:'one correction remains',changed_files:[],evidence:[],open_issues:['fix-one'],needs_context:[]})}
  const {runtime,calls}=restartHarness(m,{status:'idle',assistant}),old=m.execution.workers[0]
  const out=await runtime.start(m,{objective:m.identity.objective,role:'coder',category:'quick',scope:['src/a.ts'],dependencies:[],requiredEvidence:m.identity.intent.likelyVerification,obligationIds:m.execution.tasks[0].obligation_ids})
  assert.equal(out.worker_id,old.id);assert.equal(out.readiness,'READY');assert.equal(calls.reads,1);assert.equal(calls.aborts.length,0);assert.equal(calls.prompts.length,1)
  assert.equal(old.attempt,2);assert.equal(old.status,'busy');assert.equal(old.restart_reconcile_pending,false);assert.equal(m.execution.tasks[0].status,'running');assert.equal(m.execution.tasks[0].result?.summary,'one correction remains')
  assert.equal(m.execution.scheduler.reservations.length,1);const reservation=m.execution.scheduler.reservations[0];assert.equal(reservation.phase,'RUNNING');assert.equal(reservation.attempt.ordinal,2);assert.equal(reservation.hostExecutionId,'child-old')
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.restart-result-recovered'&&e.payload?.result==='FIX_REQUIRED'))
  assert.match(JSON.stringify(calls.prompts[0]),/corrective resume|one correction remains/i)
})

test('restart with unverified host status stays quarantined without abort or prompt replay',async()=>{
  const restored=new MissionStore();restored.restore([persistedBusyWithReservation()],true)
  const m=restored.get('parent-1');assert.ok(m)
  const {runtime,calls}=restartHarness(m,{status:'unknown'}),old=m.execution.workers[0]
  const out=await runtime.start(m,{objective:m.identity.objective,role:'coder',category:'quick',scope:['src/a.ts'],dependencies:[],requiredEvidence:m.identity.intent.likelyVerification,obligationIds:m.execution.tasks[0].obligation_ids})
  assert.equal(out.readiness,'WAIT');assert.equal(calls.aborts.length,0);assert.equal(calls.prompts.length,0);assert.equal(calls.reads,0)
  assert.equal(old.status,'ready');assert.equal(old.attempt,1);assert.equal(old.restart_reconcile_pending,true);assert.equal(m.execution.scheduler.reservations[0].phase,'RECONCILING')
  assert.ok(m.execution.ledger.some(e=>e.type==='scheduler.restart-reconcile-deferred'&&e.payload?.host_status==='unknown'))
})

test('restart before host creation reconciles pre-spawn reservation as NOT_STARTED without leaking capacity',()=>{
  const restored=new MissionStore();restored.restore([persistedBusyWithReservation({session:false})],true)
  const m=restored.get('parent-1');assert.ok(m)
  assert.equal(m.execution.workers[0].status,'failed');assert.equal(m.execution.tasks[0].status,'blocked')
  assert.deepEqual(m.execution.scheduler.reservations,[])
  assert.ok(m.execution.ledger.some(e=>e.type==='scheduler.restart-reconciled'&&e.payload?.outcome==='not-started'))
})


test('legacy team execution snapshot normalizes to scheduler-owned parallel mode without replacing durable task worker obligation or evidence identity',()=>{
  const source=persistedBusy(),task2=structuredClone(source.execution.tasks[0]),worker2=structuredClone(source.execution.workers[0])
  task2.id='team-task-2';task2.worker_id='team-worker-2';task2.objective='second team perspective'
  worker2.id='team-worker-2';worker2.task_id=task2.id;worker2.fingerprint='team-worker-2';worker2.session_id='child-team-2'
  source.execution.tasks.push(task2);source.execution.workers.push(worker2);source.execution.execution_mode='team'
  const taskIDs=source.execution.tasks.map(x=>x.id),workerIDs=source.execution.workers.map(x=>x.id),obligationIDs=source.execution.obligations.map(x=>x.id),evidenceIDs=source.execution.evidence.items.map(x=>x.id)
  const restored=new MissionStore();restored.restore([source],false)
  const m=restored.get('parent-1');assert.ok(m)
  assert.equal(m.execution.execution_mode,'parallel')
  assert.deepEqual(m.execution.tasks.map(x=>x.id),taskIDs)
  assert.deepEqual(m.execution.workers.map(x=>x.id),workerIDs)
  assert.deepEqual(m.execution.obligations.map(x=>x.id),obligationIDs)
  assert.deepEqual(m.execution.evidence.items.map(x=>x.id),evidenceIDs)
  assert.equal(m.execution.evidence.fresh,true)
  assert.ok(m.execution.workers.every(x=>x.status==='ready'&&x.restart_reconcile_pending===true))
  assert.ok(m.execution.tasks.every(x=>x.status==='waiting'&&x.result?.status==='NEEDS_CONTEXT'))
  const reset=m.execution.ledger.find(x=>x.type==='execution-mode.compatibility-normalized')
  assert.ok(reset)
  assert.equal(reset.payload.from,'team');assert.equal(reset.payload.to,'parallel');assert.equal(reset.payload.reason,'scheduler-owned-topology')
  assert.deepEqual(reset.payload.durable_tasks,taskIDs)
  assert.deepEqual(reset.payload.durable_workers,workerIDs)
})


test('restart-pending child idle can settle directly before server.connected reconciliation',async()=>{
  const restored=new MissionStore();restored.restore([persistedBusyWithReservation()],true)
  const m=restored.get('parent-1');assert.ok(m);const worker=m.execution.workers[0]
  const assistant={text:JSON.stringify({status:'DONE',summary:'idle arrived before server connect',changed_files:[],evidence:[],open_issues:[],needs_context:[]})}
  const {runtime,calls}=restartHarness(m,{status:'idle',assistant})
  const admission=await runtime.admitTerminalEvent(m,worker);assert.equal(admission.decision,'ACCEPT')
  const settled=await runtime.settleHostIdleAssistantResult(m,worker,assistant);assert.equal(settled.applied,true);assert.equal(settled.result?.status,'DONE')
  assert.equal(worker.restart_reconcile_pending,false);assert.equal(worker.status,'completed');assert.equal(m.execution.scheduler.reservations.length,0);assert.equal(calls.aborts.length,0);assert.equal(calls.prompts.length,0)
})

test('restart reconciliation reports scheduler-only terminal fencing as durable progress when assistant read is unavailable',async()=>{
  const restored=new MissionStore();restored.restore([persistedBusyWithReservation()],true)
  const m=restored.get('parent-1');assert.ok(m);const {runtime}=restartHarness(m,{status:'idle'})
  const before=m.execution.scheduler.revision,count=await runtime.reconcileRestoredChildren(m)
  assert.equal(count,1);assert.ok(m.execution.scheduler.revision>before);assert.equal(m.execution.scheduler.reservations[0].phase,'SETTLING');assert.equal(m.execution.workers[0].restart_reconcile_pending,true)
})


test('semantic follow-up after unclean restart quarantines the exact restored child then resumes the same task/session in the new generation',async()=>{
  const restored=new MissionStore();restored.restore([persistedBusyWithReservation()],true)
  const m=restored.get('parent-1');assert.ok(m);const old=m.execution.workers[0],task=m.execution.tasks[0],priorGeneration=m.continuation.generation
  const {runtime,calls}=restartHarness(m,{status:'busy'})
  restored.beginFollowupSemanticAssessment('parent-1','Continue the interrupted task from canonical state')
  assert.equal(m.continuation.generation,priorGeneration+1)
  assert.equal(await runtime.pauseForSemanticAssessment(m),1)
  assert.equal(calls.aborts.length,1,'restart-pending child is potentially in flight and must be quarantined before semantic rebase')
  assert.equal(m.execution.scheduler.reservations.length,0)
  m.identity.semantic_assessment={...m.identity.semantic_assessment,status:'assessed',assessed_at:Date.now()}
  const resumed=await runtime.resumeAfterSemanticAssessment(m,'non-material')
  assert.equal(resumed,1)
  assert.equal(old.id,m.execution.workers[0].id);assert.equal(task.id,m.execution.tasks[0].id);assert.equal(old.session_id,'child-old')
  assert.equal(old.generation_at_spawn,m.continuation.generation)
  assert.equal(old.restart_reconcile_pending,false);assert.equal(old.status,'busy');assert.equal(task.status,'running');assert.equal(old.attempt,2)
  assert.equal(calls.prompts.length,1)
  assert.equal(m.execution.scheduler.reservations.length,1);assert.equal(m.execution.scheduler.reservations[0].attempt.ordinal,2);assert.equal(m.execution.scheduler.reservations[0].attempt.generation,m.continuation.generation)
})
