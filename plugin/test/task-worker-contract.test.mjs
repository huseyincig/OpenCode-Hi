import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { createTask,createWorker,beginWorkerAttempt } from '../dist/runtime/worker/worker-runtime.js'
import { isTaskContract } from '../dist/contracts/task.js'
import { isWorkerContract } from '../dist/contracts/worker.js'
import { RuntimePersistence } from '../dist/runtime/state/persistence.js'
import { startAssessedMission } from './helpers/semantic.mjs'

function mission(id='contract-task-worker'){
  const store=new MissionStore(process.cwd())
  return startAssessedMission(store,id,'prepare release verification',{task_kind:'release-readiness',scope:'external',risk:'authority-boundary',requested_external_actions:['git-push'],required_capabilities:['verification'],likely_verification:['changed-surface-sanity']})
}

test('TaskContract snapshots mission identity and external action requirements at creation',()=>{
  const m=mission('task-contract-snapshot')
  const task=createTask(m,{objective:'verify candidate',role:'coder',category:'standard',scope:['src/a.ts'],requiredEvidence:['changed-surface-sanity']})
  assert.equal(task.mission_id,m.identity.mission_id)
  assert.deepEqual(task.external_action_requirements,['git-push'])
  assert.equal(isTaskContract(task),true)
})

test('TaskContract rejects missing mission identity, unknown fields and malformed execution snapshots',()=>{
  const m=mission('task-contract-negative')
  const task=createTask(m,{objective:'verify candidate',role:'coder',category:'standard'})
  const {mission_id,...withoutMission}=task
  assert.equal(isTaskContract(withoutMission),false)
  assert.equal(isTaskContract({...task,unexpected:true}),false)
  assert.equal(isTaskContract({...task,execution_profile:{role:'coder'}}),false)
})

test('WorkerContract starts at attempt zero and beginWorkerAttempt preserves identity while advancing lifecycle',()=>{
  const m=mission('worker-contract-attempt')
  const task=createTask(m,{objective:'verify candidate',role:'coder',category:'standard'})
  const worker=createWorker(m,task,'host-default')
  assert.equal(worker.attempt,0)
  assert.equal(isWorkerContract(worker),true)
  const id=worker.id,taskID=worker.task_id,before=worker.updated_at
  beginWorkerAttempt(task,worker,before+10)
  assert.equal(worker.id,id);assert.equal(worker.task_id,taskID)
  assert.equal(worker.attempt,1)
  assert.equal(worker.started_at,before+10)
  assert.equal(worker.updated_at,before+10)
  beginWorkerAttempt(task,worker,before+20)
  assert.equal(worker.attempt,2)
  assert.equal(worker.id,id)
})

test('WorkerContract rejects malformed recovery/effective-model state instead of persistence ignoring it',()=>{
  const m=mission('worker-contract-negative')
  const task=createTask(m,{objective:'verify candidate',role:'coder',category:'standard'})
  const worker=createWorker(m,task,'p/model')
  assert.equal(isWorkerContract({...worker,attempt:-1}),false)
  assert.equal(isWorkerContract({...worker,updated_at:'now'}),false)
  assert.equal(isWorkerContract({...worker,effective_model_verified:'yes'}),false)
  assert.equal(isWorkerContract({...worker,requested_model:7}),false)
  assert.equal(isWorkerContract({...worker,projected_model_variant:{bad:true}}),false)
  assert.equal(isWorkerContract({...worker,projected_model_variant:'high'}),false)
  assert.equal(isWorkerContract({...worker,native_diff_baseline:{'src/a.ts':7}}),false)
  assert.equal(isWorkerContract({...worker,fallback_history:[{to:'p/other',reason:'x',phase:'invalid',at:Date.now()}]}),false)
  assert.equal(isWorkerContract({...worker,unexpected:true}),false)
})

test('RuntimePersistence consumes canonical Task/Worker contracts and fails closed on corrupted worker state',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-task-worker-contract-'))
  try{
    const store=new MissionStore(root),m=startAssessedMission(store,'persist-contract','verify',{task_kind:'bug-fix',likely_verification:[]})
    const task=createTask(m,{objective:'verify',role:'coder',category:'standard'})
    const worker=createWorker(m,task,'host-default')
    worker.requested_model='p/requested';worker.model='p/selected';worker.projected_model='p/selected';worker.effective_model='p/selected';worker.effective_model_verified=true
    const persistence=new RuntimePersistence(root)
    persistence.save(store.all(),true)
    const loaded=persistence.load();assert.equal(loaded.length,1)
    assert.equal(loaded[0].execution.workers[0].requested_model,'p/requested');assert.equal(loaded[0].execution.workers[0].projected_model,'p/selected')
    worker.attempt=-1
    persistence.save(store.all(),true)
    assert.equal(persistence.load().length,0)
    assert.match(String(persistence.lastLoadReport.error),/invalid mission state/i)
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('RuntimePersistence rejects persisted mission graphs with unknown duplicate or cyclic Task dependencies',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-trajectory-contract-'))
  try{
    const store=new MissionStore(root),m=startAssessedMission(store,'trajectory-contract','verify',{task_kind:'implementation',likely_verification:[]})
    const a=createTask(m,{objective:'a',role:'coder',category:'standard'})
    const b=createTask(m,{objective:'b',role:'coder',category:'standard',dependencies:[a.id]})
    const persistence=new RuntimePersistence(root)
    persistence.save(store.all(),true);assert.equal(persistence.load().length,1)

    b.dependencies=['missing-task'];persistence.save(store.all(),true);assert.equal(persistence.load().length,0);assert.match(String(persistence.lastLoadReport.error),/invalid mission state/i)
    b.dependencies=[a.id];a.dependencies=[b.id];persistence.save(store.all(),true);assert.equal(persistence.load().length,0)
    a.dependencies=[];b.id=a.id;persistence.save(store.all(),true);assert.equal(persistence.load().length,0)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('RuntimePersistence rejects invalid persisted topology shape and single execution with parallelism above one',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-topology-contract-'))
  try{
    const store=new MissionStore(root),m=startAssessedMission(store,'topology-contract','verify',{task_kind:'implementation',likely_verification:[]})
    const persistence=new RuntimePersistence(root)
    m.execution.execution_mode='single';m.execution.topology={mode:'single-agent',parallelism:1,reason:['minimum sufficient execution']}
    persistence.save(store.all(),true);assert.equal(persistence.load().length,1)
    m.execution.topology.parallelism=2;persistence.save(store.all(),true);assert.equal(persistence.load().length,0)
    m.execution.execution_mode='parallel';m.execution.topology={mode:'multi-agent',parallelism:0,reason:['invalid']};persistence.save(store.all(),true);assert.equal(persistence.load().length,0)
  }finally{rmSync(root,{recursive:true,force:true})}
})
