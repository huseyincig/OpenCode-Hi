import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { createTask,createWorker,beginWorkerAttempt } from '../dist/runtime/worker/worker-runtime.js'
import { ConcurrencyScheduler } from '../dist/runtime/scheduler/concurrency.js'
import { startAssessedMission } from './helpers/semantic.mjs'
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

test('adapter projects legacy resource tracker into host-neutral SchedulingSnapshot',()=>{
  const m=mission('adapter-snapshot'),a=createTask(m,{objective:'a',role:'coder',category:'standard'}),wa=createWorker(m,a,'p/m1'),b=createTask(m,{objective:'b',role:'coder',category:'standard'}),wb=createWorker(m,b,'p/m2')
  wa.status='busy';a.status='running'
  const scheduler=new ConcurrencyScheduler(()=>({global:3,providers:{p:2},models:{'p/m1':1,'p/m2':2}}));assert.equal(scheduler.acquire(wa.id,'p','p/m1'),true)
  const snap=taskRuntimeSchedulingSnapshot(m,scheduler,{workerId:wb.id,model:'p/m2'})
  assert.equal(snap.capacity.topology,2);assert.equal(snap.capacity.global,3);assert.equal(snap.capacity.providers.p,2);assert.equal(snap.capacity.models['p/m1'],1)
  assert.deepEqual(snap.capacity.running,[{executionUnitId:`eu:${a.id}`,provider:'p',model:'p/m1'}])
  assert.deepEqual(snap.resolvedResources[`eu:${b.id}`],{provider:'p',model:'p/m2'})
})

test('adapter model admission is scheduler-owned and respects resource ceilings',()=>{
  const m=mission('adapter-model'),a=createTask(m,{objective:'a',role:'coder',category:'standard'}),wa=createWorker(m,a,'p/same'),b=createTask(m,{objective:'b',role:'coder',category:'standard'}),wb=createWorker(m,b,'p/same')
  wa.status='busy';a.status='running'
  const scheduler=new ConcurrencyScheduler(()=>({global:3,providers:{p:3},models:{'p/same':1,'p/other':2}}));scheduler.acquire(wa.id,'p','p/same')
  assert.equal(taskRuntimeAdmittedModel(m,wb,['p/same'],scheduler),undefined)
  assert.equal(taskRuntimeAdmittedModel(m,wb,['p/same','p/other'],scheduler),'p/other')
})

test('adapter reserves exact next attempt before host binding and releases the same reservation',()=>{
  const m=mission('adapter-lifecycle'),task=createTask(m,{objective:'x',role:'coder',category:'standard'}),worker=createWorker(m,task,'p/m')
  const scheduler=new ConcurrencyScheduler(()=>({global:2,providers:{p:2},models:{'p/m':2}}))
  let out=reserveTaskRuntimeDispatch(m,worker,'p/m',scheduler,10)
  assert.equal(out.accepted,true);assert.equal(out.reservation.phase,'RESERVED');assert.equal(out.attempt.ordinal,1);assert.equal(worker.session_id,undefined)
  const replay=reserveTaskRuntimeDispatch(m,worker,'p/m',scheduler,11);assert.equal(replay.accepted,true);assert.equal(replay.reason,'already-reserved');assert.equal(replay.reservation.reservationId,out.reservation.reservationId)
  out=bindTaskRuntimeHost(m,worker.id,'child-1',12);assert.equal(out.accepted,true);assert.equal(out.reservation.phase,'RUNNING');worker.session_id='child-1';beginWorkerAttempt(task,worker,13)
  out=beginTaskRuntimeSettlement(m,worker,14);assert.equal(out.accepted,true);assert.equal(out.reservation.phase,'SETTLING')
  out=releaseTaskRuntimeReservation(m,worker.id,'RELEASE',15);assert.equal(out.accepted,true);assert.equal(m.execution.scheduler.reservations.length,0);assert.equal(taskRuntimeReservation(m,worker.id),undefined)
})

test('adapter refuses a newer attempt while the execution unit remains reserved',()=>{
  const m=mission('adapter-double'),task=createTask(m,{objective:'x',role:'coder',category:'standard'}),worker=createWorker(m,task,'p/m')
  const scheduler=new ConcurrencyScheduler(()=>({global:2}))
  const first=reserveTaskRuntimeDispatch(m,worker,'p/m',scheduler,10);assert.equal(first.accepted,true)
  worker.attempt=1
  const newer=reserveTaskRuntimeDispatch(m,worker,'p/m',scheduler,11);assert.equal(newer.accepted,false);assert.equal(newer.reason,'unit-not-admitted')
  assert.equal(m.execution.scheduler.reservations.length,1)
})
