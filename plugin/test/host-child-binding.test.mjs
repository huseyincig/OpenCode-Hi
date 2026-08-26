import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { createTask,createWorker,beginWorkerAttempt } from '../dist/runtime/worker/worker-runtime.js'
import { admitHostTerminalEvent,admitRestartHostTerminalEvent,hostChildBinding,restartHostChildBinding } from '../dist/runtime/task/host-child-binding.js'
import { startAssessedMission } from './helpers/semantic.mjs'
import { makeChildSessionPort } from './helpers/host-port.mjs'

function fixture(sessionID='child-1'){
  const store=new MissionStore(process.cwd())
  const m=startAssessedMission(store,'parent-1','implement bounded change')
  const task=createTask(m,{objective:'implement bounded change',role:'coder',category:'standard'})
  const worker=createWorker(m,task,'provider/model')
  worker.session_id=sessionID
  worker.status='busy'
  task.status='running'
  beginWorkerAttempt(task,worker,100)
  return{m,task,worker}
}

test('HostChildBinding defers stale idle delivery while OpenCode still reports busy',async()=>{
  const {m,worker}=fixture()
  const out=await admitHostTerminalEvent(m,worker,makeChildSessionPort({status:async()=>'busy'}))
  assert.equal(out.decision,'WAIT')
  assert.equal(out.reason,'host-session-busy')
  assert.equal(out.hostStatus,'busy')
  assert.equal(out.binding?.sessionId,'child-1')
  assert.equal(out.binding?.attempt.ordinal,1)
})

test('HostChildBinding defers terminal reconciliation while OpenCode owns retry state',async()=>{
  const {m,worker}=fixture()
  const out=await admitHostTerminalEvent(m,worker,makeChildSessionPort({status:async()=>'retry'}))
  assert.equal(out.decision,'WAIT')
  assert.equal(out.reason,'host-session-retry')
  assert.equal(out.hostStatus,'retry')
})

test('HostChildBinding accepts terminal reconciliation only after live OpenCode idle confirmation',async()=>{
  const {m,worker}=fixture()
  const out=await admitHostTerminalEvent(m,worker,makeChildSessionPort({status:async()=>'idle'}))
  assert.equal(out.decision,'ACCEPT')
  assert.equal(out.reason,'host-session-idle-confirmed')
  assert.equal(out.hostStatus,'idle')
  assert.deepEqual(hostChildBinding(m,worker),out.binding)
})

test('HostChildBinding fences a same-session newer attempt that starts during the host status read',async()=>{
  const {m,task,worker}=fixture('same-session')
  const captured=hostChildBinding(m,worker)
  assert.equal(captured?.attempt.ordinal,1)
  const out=await admitHostTerminalEvent(m,worker,makeChildSessionPort({status:async()=>{
    beginWorkerAttempt(task,worker,200)
    return'idle'
  }}))
  assert.equal(worker.session_id,'same-session')
  assert.equal(worker.attempt,2)
  assert.equal(out.decision,'STALE')
  assert.equal(out.reason,'host-child-binding-changed-during-status-read')
  assert.equal(out.hostStatus,'idle')
  assert.equal(out.binding?.attempt.ordinal,1)
})


test('restart binding preserves a historical attempt identity without reopening normal stale callbacks',async()=>{
  const {m,worker}=fixture('historical-child')
  worker.restart_reconcile_pending=true
  m.continuation.generation+=1
  assert.equal(hostChildBinding(m,worker),undefined,'normal callback binding must remain generation-fenced')
  const historical=restartHostChildBinding(m,worker)
  assert.equal(historical?.generation,1)
  assert.equal(historical?.attempt.ordinal,1)
  const out=await admitRestartHostTerminalEvent(m,worker,makeChildSessionPort({status:async()=>'idle'}))
  assert.equal(out.decision,'ACCEPT')
  assert.equal(out.binding?.generation,1)
  assert.equal(out.binding?.sessionId,'historical-child')
})
