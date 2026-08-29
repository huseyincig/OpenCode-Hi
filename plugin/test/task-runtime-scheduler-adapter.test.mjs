import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { createTask,createWorker,beginWorkerAttempt } from '../dist/runtime/worker/worker-runtime.js'
import { createConcurrencyPolicySource } from '../dist/runtime/scheduler/concurrency.js'
import { startAssessedMission } from './helpers/semantic.mjs'
import {projectSchedulingPeerView} from '../dist/runtime/scheduler/project-peer-view.js'
import {
  taskRuntimeSchedulingSnapshot,
  taskRuntimeAdmittedModel,
  reserveTaskRuntimeDispatch,
  bindTaskRuntimeHost,
  beginTaskRuntimeSettlement,
  releaseTaskRuntimeReservation,
  taskRuntimeReservation,
} from '../dist/runtime/scheduler/task-runtime-adapter.js'

function mission(id='runtime-scheduler-adapter'){
  const m=startAssessedMission(new MissionStore(),id,'schedule work',{task_kind:'implementation',scope:'multi-stream',required_capabilities:['implementation'],likely_verification:[]})
  m.execution.execution_mode='parallel';m.execution.topology={mode:'multi-agent',parallelism:2,reason:['test']};return m
}

test('adapter projects durable scheduler reservations into host-neutral SchedulingSnapshot',()=>{
  const m=mission('adapter-snapshot'),a=createTask(m,{objective:'a',role:'coder',category:'standard'}),wa=createWorker(m,a,'p/m1')
  const scheduler=createConcurrencyPolicySource(()=>({global:3,providers:{p:2},models:{'p/m1':1,'p/m2':2}}));assert.equal(reserveTaskRuntimeDispatch(m,wa,'p/m1',scheduler,10).accepted,true);wa.status='busy';a.status='running'
  const b=createTask(m,{objective:'b',role:'coder',category:'standard'}),wb=createWorker(m,b,'p/m2')
  const snap=taskRuntimeSchedulingSnapshot(m,scheduler,{workerId:wb.id,model:'p/m2'})
  assert.equal(snap.capacity.topology,2);assert.equal(snap.capacity.global,3);assert.equal(snap.capacity.providers.p,2);assert.equal(snap.capacity.models['p/m1'],1)
  assert.deepEqual(snap.capacity.running,[{executionUnitId:`eu:${a.id}`,provider:'p',model:'p/m1'}])
  assert.deepEqual(snap.resolvedResources[`eu:${b.id}`],{provider:'p',model:'p/m2'})
})

test('adapter model admission is scheduler-owned and respects resource ceilings',()=>{
  const m=mission('adapter-model'),a=createTask(m,{objective:'a',role:'coder',category:'standard',scope:['src/a.ts']}),wa=createWorker(m,a,'p/same')
  const scheduler=createConcurrencyPolicySource(()=>({global:3,providers:{p:3},models:{'p/same':1,'p/other':2}}));assert.equal(reserveTaskRuntimeDispatch(m,wa,'p/same',scheduler,10).accepted,true);wa.status='busy';a.status='running'
  const b=createTask(m,{objective:'b',role:'coder',category:'standard',scope:['src/b.ts']}),wb=createWorker(m,b,'p/same')
  assert.equal(taskRuntimeAdmittedModel(m,wb,['p/same'],scheduler),undefined)
  assert.equal(taskRuntimeAdmittedModel(m,wb,['p/same','p/other'],scheduler),'p/other')
})



test('durable reservation alone is the running resource truth for later admission and release',()=>{
  const m=mission('adapter-reservation-capacity'),a=createTask(m,{objective:'a',role:'coder',category:'standard',scope:['src/a.ts']}),wa=createWorker(m,a,'p/same')
  const scheduler=createConcurrencyPolicySource(()=>({global:3,providers:{p:3},models:{'p/same':1,'p/other':2}}))
  const reserved=reserveTaskRuntimeDispatch(m,wa,'p/same',scheduler,10);assert.equal(reserved.accepted,true);wa.status='busy';a.status='running'
  assert.equal(typeof scheduler.policySnapshot,'function');assert.equal('running' in scheduler,false,'policy source must not carry a second running-allocation store')
  const b=createTask(m,{objective:'b',role:'coder',category:'standard',scope:['src/b.ts']}),wb=createWorker(m,b,'p/same')
  const snap=taskRuntimeSchedulingSnapshot(m,scheduler,{workerId:wb.id,model:'p/same'})
  assert.deepEqual(snap.capacity.running,[{executionUnitId:`eu:${a.id}`,provider:'p',model:'p/same'}])
  assert.equal(taskRuntimeAdmittedModel(m,wb,['p/same'],scheduler),undefined)
  assert.equal(taskRuntimeAdmittedModel(m,wb,['p/same','p/other'],scheduler),'p/other')
  const released=releaseTaskRuntimeReservation(m,wa.id,'RELEASE',11);assert.equal(released.accepted,true);wa.status='completed';a.status='completed'
  assert.equal(taskRuntimeAdmittedModel(m,wb,['p/same'],scheduler),'p/same')
})
test('adapter reserves exact next attempt before host binding and releases the same reservation',()=>{
  const m=mission('adapter-lifecycle'),task=createTask(m,{objective:'x',role:'coder',category:'standard'}),worker=createWorker(m,task,'p/m')
  const scheduler=createConcurrencyPolicySource(()=>({global:2,providers:{p:2},models:{'p/m':2}}))
  let out=reserveTaskRuntimeDispatch(m,worker,'p/m',scheduler,10)
  assert.equal(out.accepted,true);assert.equal(out.reservation.phase,'RESERVED');assert.equal(out.attempt.ordinal,1);assert.equal(worker.session_id,undefined)
  const replay=reserveTaskRuntimeDispatch(m,worker,'p/m',scheduler,11);assert.equal(replay.accepted,true);assert.equal(replay.reason,'already-reserved');assert.equal(replay.reservation.reservationId,out.reservation.reservationId)
  out=bindTaskRuntimeHost(m,worker.id,'child-1',12);assert.equal(out.accepted,true);assert.equal(out.reservation.phase,'RUNNING');worker.session_id='child-1';beginWorkerAttempt(task,worker,13)
  out=beginTaskRuntimeSettlement(m,worker,14);assert.equal(out.accepted,true);assert.equal(out.reservation.phase,'SETTLING')
  out=releaseTaskRuntimeReservation(m,worker.id,'RELEASE',15);assert.equal(out.accepted,true);assert.equal(m.execution.scheduler.reservations.length,0);assert.equal(taskRuntimeReservation(m,worker.id),undefined)
})

test('adapter refuses a newer attempt while the execution unit remains reserved',()=>{
  const m=mission('adapter-double'),task=createTask(m,{objective:'x',role:'coder',category:'standard'}),worker=createWorker(m,task,'p/m')
  const scheduler=createConcurrencyPolicySource(()=>({global:2}))
  const first=reserveTaskRuntimeDispatch(m,worker,'p/m',scheduler,10);assert.equal(first.accepted,true)
  worker.attempt=1
  const newer=reserveTaskRuntimeDispatch(m,worker,'p/m',scheduler,11);assert.equal(newer.accepted,false);assert.equal(newer.reason,'unit-not-admitted')
  assert.equal(m.execution.scheduler.reservations.length,1)
})


test('adapter counts peer-mission durable reservations toward project global/model capacity without consuming local topology',()=>{
  const a=mission('peer-cap-a'),b=mission('peer-cap-b')
  a.execution.topology.parallelism=1;b.execution.topology.parallelism=1
  const ta=createTask(a,{objective:'a',role:'coder',category:'standard',scope:['src/a.ts']}),wa=createWorker(a,ta,'p/same')
  const scheduler=createConcurrencyPolicySource(()=>({global:1,providers:{p:1},models:{'p/same':1}}))
  assert.equal(reserveTaskRuntimeDispatch(a,wa,'p/same',scheduler,10).accepted,true);wa.status='busy';ta.status='running'
  const tb=createTask(b,{objective:'b',role:'coder',category:'standard',scope:['src/b.ts']}),wb=createWorker(b,tb,'p/same')
  const snap=taskRuntimeSchedulingSnapshot(b,scheduler,{workerId:wb.id,model:'p/same'},projectSchedulingPeerView(b,[a,b]))
  assert.equal(snap.capacity.running.length,1)
  assert.equal(snap.capacity.running[0].missionId,a.identity.mission_id)
  assert.equal(taskRuntimeAdmittedModel(b,wb,['p/same'],scheduler,projectSchedulingPeerView(b,[a,b])),undefined,'peer reservation must consume project-global/model capacity')
  const localOnly=taskRuntimeSchedulingSnapshot(b,createConcurrencyPolicySource(()=>({global:4})),{workerId:wb.id,model:'p/same'},projectSchedulingPeerView(b,[a,b]))
  assert.equal(localOnly.capacity.topology,1,'peer work must not consume this mission topology limit')
})


test('new dispatch admission ignores retained waiting results while exact corrective resume stays admissible',()=>{
  const m=mission('adapter-waiting-starvation');m.execution.execution_mode='single';m.execution.topology={mode:'single-agent',parallelism:1,reason:['test']}
  const writerTask=createTask(m,{objective:'review docs',role:'technical-writer',category:'documentation',scope:['CHANGELOG.md','packages/cli/index.js']}),writer=createWorker(m,writerTask,'p/m')
  writerTask.created_at=10;writerTask.updated_at=10;writerTask.status='waiting';writerTask.result={status:'FIX_REQUIRED',summary:'reconcile bounded scope expansion',changed_files:['CHANGELOG.md'],evidence:[],open_issues:['diff-cleanliness'],needs_context:['reconcile']};writer.status='ready';writer.session_id='writer-session';writer.attempt=2
  const reviewTask=createTask(m,{objective:'independent dependency review',role:'security-reviewer',category:'deep',scope:['packages/cli']}),reviewer=createWorker(m,reviewTask,'p/m')
  reviewTask.created_at=20;reviewTask.updated_at=20;reviewTask.status='queued';reviewer.status='queued'
  const scheduler=createConcurrencyPolicySource(()=>({global:4,providers:{p:4},models:{'p/m':4}}))
  assert.equal(taskRuntimeAdmittedModel(m,reviewer,['p/m'],scheduler),'p/m','retained waiting result must not consume a new-dispatch admission slot')
  assert.equal(taskRuntimeAdmittedModel(m,writer,['p/m'],scheduler,undefined,writerTask.id),'p/m','explicit exact-task corrective resume must remain schedulable')
})
