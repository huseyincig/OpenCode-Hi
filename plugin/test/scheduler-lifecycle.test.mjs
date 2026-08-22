import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { createTask,createWorker } from '../dist/runtime/worker/worker-runtime.js'
import { projectMissionToWorkGraph } from '../dist/runtime/execution/work-graph-projection.js'
import { executionAttemptIdentity } from '../dist/contracts/orchestration-core.js'
import { createSchedulerLifecycleState,planSchedulerAdmissions,reduceSchedulerLifecycle,reserveSchedulerUnit } from '../dist/runtime/scheduler/lifecycle.js'
import { startAssessedMission } from './helpers/semantic.mjs'

function mission(id='scheduler-lifecycle'){
  const m=startAssessedMission(new MissionStore(),id,'schedule work',{task_kind:'implementation',scope:'multi-stream',required_capabilities:['implementation'],likely_verification:[]})
  m.execution.execution_mode='parallel';m.execution.topology={mode:'multi-agent',parallelism:2,reason:['test']};return m
}
function unitID(task){return`eu:${task.id}`}
function snapshot(m,{traits={},resources={},global=4,providers={},models={},running=[]}={}){
  return{graph:projectMissionToWorkGraph(m,1),unitTraits:traits,resolvedResources:resources,capacity:{topology:m.execution.topology?.parallelism??1,global,providers,models,running}}
}
function nextAttempt(task,worker,generation=worker.generation_at_spawn){return executionAttemptIdentity({executionUnitId:unitID(task),workerId:worker.id,ordinal:worker.attempt+1,generation})}

test('admission is fairness ordered and simulates topology capacity across selected units',()=>{
  const m=mission('admission-fairness'),a=createTask(m,{objective:'older',role:'coder',category:'standard',scope:['a']}),b=createTask(m,{objective:'newer',role:'coder',category:'standard',scope:['b']})
  a.created_at=10;b.created_at=20;m.execution.topology.parallelism=1
  const state=createSchedulerLifecycleState(m.identity.mission_id),plan=planSchedulerAdmissions(snapshot(m,{global:5}),state)
  assert.deepEqual(plan.executionUnitIds,[unitID(a)])
  m.execution.topology.parallelism=2
  const expanded=planSchedulerAdmissions(snapshot(m,{global:5}),state)
  assert.deepEqual(expanded.executionUnitIds,[unitID(a),unitID(b)])
})

test('independent units sharing one model are admitted in parallel below model capacity',()=>{
  const m=mission('same-model-admission'),a=createTask(m,{objective:'a',role:'coder',category:'standard',scope:['a']}),b=createTask(m,{objective:'b',role:'coder',category:'standard',scope:['b']})
  m.execution.topology.parallelism=2
  const resources={[unitID(a)]:{provider:'p',model:'p/same'},[unitID(b)]:{provider:'p',model:'p/same'}}
  const plan=planSchedulerAdmissions(snapshot(m,{resources,global:4,providers:{p:4},models:{'p/same':2}}),createSchedulerLifecycleState(m.identity.mission_id))
  assert.deepEqual(new Set(plan.executionUnitIds),new Set([unitID(a),unitID(b)]))
  assert.equal(plan.executionUnitIds.length,2)
})

test('reservation is idempotent for the same attempt and rejects a newer attempt while occupied',()=>{
  const m=mission('reserve-idempotent'),task=createTask(m,{objective:'x',role:'coder',category:'standard',scope:['x']}),worker=createWorker(m,task,'p/m')
  const snap=snapshot(m,{resources:{[unitID(task)]:{provider:'p',model:'p/m'}}}),attempt=nextAttempt(task,worker)
  let state=createSchedulerLifecycleState(m.identity.mission_id)
  let out=reserveSchedulerUnit(snap,state,{executionUnitId:unitID(task),workerId:worker.id,attempt,at:10});assert.equal(out.accepted,true);assert.equal(out.reason,'reserved');state=out.state
  const replay=reserveSchedulerUnit(snap,state,{executionUnitId:unitID(task),workerId:worker.id,attempt,at:11});assert.equal(replay.accepted,true);assert.equal(replay.reason,'already-reserved');assert.deepEqual(replay.state,state)
  const newer=nextAttempt(task,{...worker,attempt:worker.attempt+1});out=reduceSchedulerLifecycle(state,{type:'RESERVE',missionId:m.identity.mission_id,workNodeId:task.id,workerId:worker.id,attempt:newer,resource:{provider:'p',model:'p/m'},at:12});assert.equal(out.accepted,false);assert.equal(out.reason,'execution-unit-already-reserved')
})

test('host binding and settlement reject stale attempt or host execution fences',()=>{
  const m=mission('settlement-fence'),task=createTask(m,{objective:'x',role:'coder',category:'standard'}),worker=createWorker(m,task,'p/m')
  const snap=snapshot(m),attempt=nextAttempt(task,worker)
  let out=reserveSchedulerUnit(snap,createSchedulerLifecycleState(m.identity.mission_id),{executionUnitId:unitID(task),workerId:worker.id,attempt,at:10});let state=out.state;const id=out.reservation.reservationId
  out=reduceSchedulerLifecycle(state,{type:'HOST_BOUND',reservationId:id,attempt,hostExecutionId:'host-1',at:11});assert.equal(out.accepted,true);assert.equal(out.reservation.phase,'RUNNING');state=out.state
  const stale=executionAttemptIdentity({executionUnitId:unitID(task),workerId:worker.id,ordinal:attempt.ordinal,generation:attempt.generation+1})
  out=reduceSchedulerLifecycle(state,{type:'BEGIN_SETTLEMENT',reservationId:id,attempt:stale,hostExecutionId:'host-1',at:12});assert.equal(out.accepted,false);assert.equal(out.reason,'stale-attempt')
  out=reduceSchedulerLifecycle(state,{type:'BEGIN_SETTLEMENT',reservationId:id,attempt,hostExecutionId:'host-old',at:12});assert.equal(out.accepted,false);assert.equal(out.reason,'stale-host-execution')
  out=reduceSchedulerLifecycle(state,{type:'BEGIN_SETTLEMENT',reservationId:id,attempt,hostExecutionId:'host-1',at:13});assert.equal(out.accepted,true);assert.equal(out.reservation.phase,'SETTLING');state=out.state
  out=reduceSchedulerLifecycle(state,{type:'RELEASE',reservationId:id,attempt,hostExecutionId:'host-1',at:14});assert.equal(out.accepted,true);assert.equal(out.state.reservations.length,0)
})

test('restart quarantine fails closed until an exact reconciliation outcome is supplied',()=>{
  const m=mission('restart-reconcile'),a=createTask(m,{objective:'pre-host',role:'coder',category:'standard',scope:['src/a.ts']}),wa=createWorker(m,a,'p/m'),b=createTask(m,{objective:'bound-host',role:'coder',category:'standard',scope:['src/b.ts']}),wb=createWorker(m,b,'p/m')
  const snap=snapshot(m),aa=nextAttempt(a,wa),ab=nextAttempt(b,wb)
  let state=createSchedulerLifecycleState(m.identity.mission_id)
  let out=reserveSchedulerUnit(snap,state,{executionUnitId:unitID(a),workerId:wa.id,attempt:aa,at:10});state=out.state;const ra=out.reservation.reservationId
  out=reserveSchedulerUnit(snap,state,{executionUnitId:unitID(b),workerId:wb.id,attempt:ab,at:11});state=out.state;const rb=out.reservation.reservationId
  out=reduceSchedulerLifecycle(state,{type:'HOST_BOUND',reservationId:rb,attempt:ab,hostExecutionId:'host-b',at:12});state=out.state
  out=reduceSchedulerLifecycle(state,{type:'RESTART_QUARANTINE',at:20});state=out.state;assert.deepEqual(state.reservations.map(x=>x.phase),['RECONCILING','RECONCILING'])
  out=reduceSchedulerLifecycle(state,{type:'RECONCILE',reservationId:ra,attempt:aa,outcome:'NOT_STARTED',at:21});assert.equal(out.accepted,true);state=out.state;assert.equal(state.reservations.some(x=>x.reservationId===ra),false)
  out=reduceSchedulerLifecycle(state,{type:'RECONCILE',reservationId:rb,attempt:ab,outcome:'UNKNOWN',at:22});assert.equal(out.accepted,true);assert.equal(out.reservation.phase,'RECONCILING')
  out=reduceSchedulerLifecycle(out.state,{type:'RECONCILE',reservationId:rb,attempt:ab,hostExecutionId:'host-b',outcome:'ACTIVE',at:23});assert.equal(out.accepted,true);assert.equal(out.reservation.phase,'RUNNING')
})

test('invalid cyclic graph cannot produce scheduler admissions',()=>{
  const m=mission('admission-cycle'),a=createTask(m,{objective:'a',role:'coder',category:'standard'}),b=createTask(m,{objective:'b',role:'coder',category:'standard',dependencies:[a.id]});a.dependencies=[b.id]
  const plan=planSchedulerAdmissions(snapshot(m),createSchedulerLifecycleState(m.identity.mission_id))
  assert.equal(plan.ok,false);assert.deepEqual(plan.executionUnitIds,[]);assert.match(plan.reasons.join('|'),/dependency-cycle/)
})


test('fan-in admission waits for every dependency and fails closed on failed or cancelled prerequisites',()=>{
  const m=mission('fan-in'),a=createTask(m,{objective:'a',role:'coder',category:'standard'}),b=createTask(m,{objective:'b',role:'coder',category:'standard'}),join=createTask(m,{objective:'join',role:'coder',category:'standard',dependencies:[a.id,b.id]})
  a.status='completed';b.status='created'
  let plan=planSchedulerAdmissions(snapshot(m),createSchedulerLifecycleState(m.identity.mission_id))
  assert.equal(plan.executionUnitIds.includes(unitID(join)),false)
  b.status='completed';plan=planSchedulerAdmissions(snapshot(m),createSchedulerLifecycleState(m.identity.mission_id));assert.equal(plan.executionUnitIds.includes(unitID(join)),true)
  b.status='failed';plan=planSchedulerAdmissions(snapshot(m),createSchedulerLifecycleState(m.identity.mission_id));assert.equal(plan.executionUnitIds.includes(unitID(join)),false)
  b.status='cancelled';plan=planSchedulerAdmissions(snapshot(m),createSchedulerLifecycleState(m.identity.mission_id));assert.equal(plan.executionUnitIds.includes(unitID(join)),false)
})

test('mutable-surface conflicts admit only the deterministic predecessor and unblock after it becomes terminal',()=>{
  const m=mission('lifecycle-conflict'),a=createTask(m,{objective:'first',role:'coder',category:'standard',scope:['src/shared']}),b=createTask(m,{objective:'second',role:'coder',category:'standard',scope:['src/shared/file.ts']})
  a.created_at=10;a.updated_at=10;b.created_at=20;b.updated_at=20
  let plan=planSchedulerAdmissions(snapshot(m),createSchedulerLifecycleState(m.identity.mission_id))
  assert.equal(plan.executionUnitIds.includes(unitID(a)),true)
  assert.equal(plan.executionUnitIds.includes(unitID(b)),false)
  a.status='completed';plan=planSchedulerAdmissions(snapshot(m),createSchedulerLifecycleState(m.identity.mission_id));assert.equal(plan.executionUnitIds.includes(unitID(b)),true)
})


test('unknown mutable write surfaces serialize before dispatch while read-only unknown surfaces may still fan out',()=>{
  const m=mission('unknown-mutable-surface'),a=createTask(m,{objective:'unknown writer a',role:'coder',category:'standard',scope:[]}),b=createTask(m,{objective:'unknown writer b',role:'coder',category:'standard',scope:[]})
  a.created_at=10;a.updated_at=10;b.created_at=20;b.updated_at=20
  let plan=planSchedulerAdmissions(snapshot(m),createSchedulerLifecycleState(m.identity.mission_id))
  assert.deepEqual(plan.executionUnitIds,[unitID(a)])
  a.status='completed';plan=planSchedulerAdmissions(snapshot(m),createSchedulerLifecycleState(m.identity.mission_id));assert.equal(plan.executionUnitIds.includes(unitID(b)),true)

  const readMission=mission('unknown-readonly-surface'),x=createTask(readMission,{objective:'read a',role:'repository-explorer',category:'quick',scope:[]}),y=createTask(readMission,{objective:'read b',role:'architect',category:'quick',scope:[]})
  x.created_at=10;x.updated_at=10;y.created_at=20;y.updated_at=20
  const readPlan=planSchedulerAdmissions(snapshot(readMission,{traits:{[unitID(x)]:{readOnly:true},[unitID(y)]:{readOnly:true}}}),createSchedulerLifecycleState(readMission.identity.mission_id))
  assert.deepEqual(new Set(readPlan.executionUnitIds),new Set([unitID(x),unitID(y)]))
})
