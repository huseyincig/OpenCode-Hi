import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync,rmSync,readFileSync,writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { createTask,createWorker,beginWorkerAttempt } from '../dist/runtime/worker/worker-runtime.js'
import { isTaskContract } from '../dist/contracts/task.js'
import { isWorkerContract } from '../dist/contracts/worker.js'
import { RuntimePersistence } from '../dist/runtime/state/persistence.js'
import { startAssessedMission } from './helpers/semantic.mjs'
import { executionAttemptIdentity } from '../dist/contracts/orchestration-core.js'
import { reduceSchedulerLifecycle } from '../dist/runtime/scheduler/lifecycle.js'

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
  worker.last_result_digest='attempt-1-result';worker.last_result_at=before+15
  beginWorkerAttempt(task,worker,before+20)
  assert.equal(worker.attempt,2)
  assert.equal(worker.id,id)
  assert.equal(worker.last_result_digest,undefined,'a new attempt must not inherit prior-attempt content idempotency')
  assert.equal(worker.last_result_at,undefined)
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
    const raw=JSON.parse(readFileSync(persistence.path,'utf8'));raw.missions[0].execution.workers[0].attempt=-1;writeFileSync(persistence.path,JSON.stringify(raw))
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

    const baseline=JSON.parse(readFileSync(persistence.path,'utf8')),ia=baseline.missions[0].execution.tasks.findIndex(t=>t.id===a.id),ib=baseline.missions[0].execution.tasks.findIndex(t=>t.id===b.id)
    let raw=structuredClone(baseline);raw.missions[0].execution.tasks[ib].dependencies=['missing-task'];writeFileSync(persistence.path,JSON.stringify(raw));assert.equal(persistence.load().length,0);assert.match(String(persistence.lastLoadReport.error),/invalid mission state/i)
    raw=structuredClone(baseline);raw.missions[0].execution.tasks[ia].dependencies=[b.id];writeFileSync(persistence.path,JSON.stringify(raw));assert.equal(persistence.load().length,0)
    raw=structuredClone(baseline);raw.missions[0].execution.tasks[ib].id=a.id;writeFileSync(persistence.path,JSON.stringify(raw));assert.equal(persistence.load().length,0)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('RuntimePersistence rejects invalid persisted topology shape and single execution with parallelism above one',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-topology-contract-'))
  try{
    const store=new MissionStore(root),m=startAssessedMission(store,'topology-contract','verify',{task_kind:'implementation',likely_verification:[]})
    const persistence=new RuntimePersistence(root)
    m.execution.execution_mode='single';m.execution.topology={mode:'single-agent',parallelism:1,reason:['minimum sufficient execution']}
    persistence.save(store.all(),true);assert.equal(persistence.load().length,1)
    const baseline=JSON.parse(readFileSync(persistence.path,'utf8'));let raw=structuredClone(baseline);raw.missions[0].execution.topology.parallelism=2;writeFileSync(persistence.path,JSON.stringify(raw));assert.equal(persistence.load().length,0)
    raw=structuredClone(baseline);raw.missions[0].execution.execution_mode='parallel';raw.missions[0].execution.topology={mode:'multi-agent',parallelism:0,reason:['invalid']};writeFileSync(persistence.path,JSON.stringify(raw));assert.equal(persistence.load().length,0)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('Mission validator rejects ghost workers, cross-session worker binding and duplicate native session ownership',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-pb-worker-binding-'))
  try{
    const store=new MissionStore(root),m=startAssessedMission(store,'pb-worker-binding','verify',{task_kind:'implementation',likely_verification:[]})
    const a=createTask(m,{objective:'a',role:'coder',category:'standard'}),wa=createWorker(m,a,'host-default')
    const b=createTask(m,{objective:'b',role:'coder',category:'standard'}),wb=createWorker(m,b,'host-default')
    wa.session_id='native-a';wb.session_id='native-b'
    const persistence=new RuntimePersistence(root)
    persistence.save(store.all(),true);assert.equal(persistence.load().length,1)

    const baseline=JSON.parse(readFileSync(persistence.path,'utf8')),workers=baseline.missions[0].execution.workers
    let raw=structuredClone(baseline),ghost=structuredClone(workers.find(x=>x.id===wb.id));ghost.id='w-ghost';ghost.session_id='native-ghost';raw.missions[0].execution.workers.push(ghost);writeFileSync(persistence.path,JSON.stringify(raw));assert.equal(persistence.load().length,0,'extra worker not owned by task.worker_id must fail closed')
    raw=structuredClone(baseline);raw.missions[0].execution.workers.find(x=>x.id===wb.id).parent_session_id='foreign-parent';writeFileSync(persistence.path,JSON.stringify(raw));assert.equal(persistence.load().length,0,'worker parent_session_id must bind exact Mission session')
    raw=structuredClone(baseline);raw.missions[0].execution.workers.find(x=>x.id===wb.id).session_id=wa.session_id;writeFileSync(persistence.path,JSON.stringify(raw));assert.equal(persistence.load().length,0,'two workers cannot own one native child session')
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('RuntimePersistence preserves canonical scheduler reservations and rejects corrupted fencing identity',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-scheduler-persist-'))
  try{
    const store=new MissionStore(root),m=startAssessedMission(store,'scheduler-persist','verify',{task_kind:'implementation',likely_verification:[]})
    const task=createTask(m,{objective:'x',role:'coder',category:'standard'}),worker=createWorker(m,task,'p/m')
    const attempt=executionAttemptIdentity({executionUnitId:`eu:${task.id}`,workerId:worker.id,ordinal:1,generation:m.continuation.generation})
    let transition=reduceSchedulerLifecycle(m.execution.scheduler,{type:'RESERVE',missionId:m.identity.mission_id,workNodeId:task.id,workerId:worker.id,attempt,resource:{provider:'p',model:'p/m'},at:10})
    assert.equal(transition.accepted,true);m.execution.scheduler=transition.state
    const persistence=new RuntimePersistence(root);persistence.save(store.all(),true)
    const loaded=persistence.load();assert.equal(loaded.length,1);assert.equal(loaded[0].execution.scheduler.reservations.length,1);assert.equal(loaded[0].execution.scheduler.reservations[0].attempt.attemptId,attempt.attemptId)
    let corrupted=JSON.parse(readFileSync(persistence.path,'utf8'));corrupted.missions[0].execution.scheduler.reservations[0].attempt.generation+=1;writeFileSync(persistence.path,JSON.stringify(corrupted));assert.equal(persistence.load().length,0);assert.match(String(persistence.lastLoadReport.error),/invalid mission state/i)
    persistence.save(store.all(),true);corrupted=JSON.parse(readFileSync(persistence.path,'utf8'));corrupted.missions[0].execution.scheduler.nextTicket=1;writeFileSync(persistence.path,JSON.stringify(corrupted));assert.equal(persistence.load().length,0,'scheduler nextTicket cannot rewind behind a durable reservation')
    persistence.save(store.all(),true);corrupted=JSON.parse(readFileSync(persistence.path,'utf8'));corrupted.missions[0].execution.scheduler.reservations[0].phase='RUNNING';delete corrupted.missions[0].execution.scheduler.reservations[0].hostExecutionId;writeFileSync(persistence.path,JSON.stringify(corrupted));assert.equal(persistence.load().length,0,'RUNNING reservation requires exact host execution binding')
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('RuntimePersistence accepts pre-scheduler schema-10 mission state and MissionStore restore quarantines durable reservations',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-scheduler-restore-'))
  try{
    const store=new MissionStore(root),m=startAssessedMission(store,'scheduler-restore','verify',{task_kind:'implementation',likely_verification:[]})
    const task=createTask(m,{objective:'x',role:'coder',category:'standard'}),worker=createWorker(m,task,'p/m')
    const attempt=executionAttemptIdentity({executionUnitId:`eu:${task.id}`,workerId:worker.id,ordinal:1,generation:m.continuation.generation})
    let transition=reduceSchedulerLifecycle(m.execution.scheduler,{type:'RESERVE',missionId:m.identity.mission_id,workNodeId:task.id,workerId:worker.id,attempt,resource:{provider:'p',model:'p/m'},at:10});m.execution.scheduler=transition.state
    transition=reduceSchedulerLifecycle(m.execution.scheduler,{type:'HOST_BOUND',reservationId:transition.reservation.reservationId,attempt,hostExecutionId:'child-1',at:11});m.execution.scheduler=transition.state
    worker.session_id='child-1';worker.attempt=1;worker.status='busy';task.status='running'
    const persistence=new RuntimePersistence(root);persistence.save(store.all(),false)
    let loaded=persistence.load();assert.equal(loaded.length,1)
    const restored=new MissionStore(root);restored.restore(loaded,true);const recovered=restored.get('scheduler-restore');assert.equal(recovered.execution.scheduler.reservations[0].phase,'RECONCILING');assert.equal(recovered.execution.scheduler.reservations[0].hostExecutionId,'child-1')

    const raw=JSON.parse(readFileSync(persistence.path,'utf8'));delete raw.missions[0].execution.scheduler;writeFileSync(persistence.path,JSON.stringify(raw));loaded=persistence.load();assert.equal(loaded.length,1,'older schema-10 missions without scheduler state remain readable')
    const legacyRestored=new MissionStore(root);legacyRestored.restore(loaded,false);assert.deepEqual(legacyRestored.get('scheduler-restore').execution.scheduler.reservations,[])
  }finally{rmSync(root,{recursive:true,force:true})}
})
