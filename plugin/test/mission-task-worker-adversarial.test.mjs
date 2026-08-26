import test from 'node:test'
import assert from 'node:assert/strict'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ChildExecutionCoordinator} from '../dist/runtime/task/child-execution-coordinator.js'
import {TaskRecoveryCoordinator} from '../dist/runtime/task/task-recovery-coordinator.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {opencodeChildPort} from './helpers/host-port.mjs'

function worker(id,task,session){return{id,task_id:task,role:'coder',category:'standard',session_id:session,parent_session_id:'parent',parent_mission_id:'mission',fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:id,status:'busy',attempt:1,generation_at_spawn:1,updated_at:Date.now()}}

test('callback resolver fails closed on ambiguous duplicate native session ownership',()=>{
  const registry=new BackgroundRegistry(),child=new ChildExecutionCoordinator(opencodeChildPort({}), registry)
  registry.set(worker('w1','t1','same-session'));registry.set(worker('w2','t2','same-session'))
  assert.equal(child.resolveCallbackWorker('same-session'),undefined)
  registry.delete('w2');assert.equal(child.resolveCallbackWorker('same-session')?.id,'w1')
})

test('reordered callback from superseded child session cannot bind the current worker',()=>{
  const registry=new BackgroundRegistry(),child=new ChildExecutionCoordinator(opencodeChildPort({}), registry),w=worker('w1','t1','old-session')
  registry.set(w);assert.equal(child.resolveCallbackWorker('old-session')?.id,'w1')
  w.session_id='new-session';registry.set(w)
  assert.equal(child.resolveCallbackWorker('old-session'),undefined,'late callback from superseded session must become ownerless')
  assert.equal(child.resolveCallbackWorker('new-session')?.id,'w1')
})

test('callback disposition fences stale mission identity but does not let restart quarantine hide native callbacks',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'pb-callback-order','verify',{task_kind:'implementation',likely_verification:[]})
  const task=createTask(m,{objective:'x',role:'coder',category:'standard'}),w=createWorker(m,task,'host-default')
  const recovery=new TaskRecoveryCoordinator({},{},process.cwd(),()=>({}),()=>[],()=>({}),undefined,{},()=>{})
  w.parent_mission_id=m.identity.mission_id;w.generation_at_spawn=m.continuation.generation
  w.restart_reconcile_pending=true;assert.equal(recovery.callbackDisposition(m,w),'accept','restart quarantine is scheduler state, not a callback lifecycle owner')
  w.generation_at_spawn=m.continuation.generation-1;assert.equal(recovery.callbackDisposition(m,w),'stale-mission')
  w.restart_reconcile_pending=false;w.generation_at_spawn=m.continuation.generation;assert.equal(recovery.callbackDisposition(m,w),'accept')
})
