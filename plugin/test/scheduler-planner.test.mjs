import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { createTask,createWorker } from '../dist/runtime/worker/worker-runtime.js'
import { projectMissionToWorkGraph } from '../dist/runtime/execution/work-graph-projection.js'
import { planScheduling } from '../dist/runtime/scheduler/planner.js'
import { ConcurrencyScheduler } from '../dist/runtime/scheduler/concurrency.js'
import { parallelSafety } from '../dist/runtime/scheduler/parallel-safety.js'
import { startAssessedMission } from './helpers/semantic.mjs'

function mission(id='sched-plan'){
  const m=startAssessedMission(new MissionStore(),id,'schedule work',{task_kind:'implementation',scope:'multi-stream',required_capabilities:['implementation'],likely_verification:[]})
  m.execution.execution_mode='parallel';m.execution.topology={mode:'multi-agent',parallelism:2,reason:['test']};return m
}
function snapshot(m,{traits={},resources={},global=4,providers={},models={},running=[]}={}){
  return{graph:projectMissionToWorkGraph(m,1),unitTraits:traits,resolvedResources:resources,capacity:{topology:m.execution.execution_mode==='single'?1:m.execution.topology?.parallelism??1,global,providers,models,running}}
}
function unitID(task){return`eu:${task.id}`}
function decision(plan,id){return plan.units.find(x=>x.executionUnitId===id)}

test('planner classifies ready, waiting and failed dependencies deterministically',()=>{
  const m=mission('dep-classify'),a=createTask(m,{objective:'a',role:'coder',category:'standard'}),b=createTask(m,{objective:'b',role:'coder',category:'standard',dependencies:[a.id]})
  let plan=planScheduling(snapshot(m));assert.equal(decision(plan,unitID(a)).disposition,'RUNNABLE');assert.equal(decision(plan,unitID(b)).disposition,'WAITING_DEPENDENCY')
  a.status='failed';plan=planScheduling(snapshot(m));assert.equal(decision(plan,unitID(b)).disposition,'BLOCKED_DEPENDENCY');assert.equal(decision(plan,unitID(b)).reasons[0].code,'dependency-failed')
  const corrupted=snapshot(m);corrupted.graph.executionUnits.find(x=>x.workNodeId===b.id).dependencies=['missing'];plan=planScheduling(corrupted);assert.equal(decision(plan,unitID(b)).reasons[0].code,'unknown-dependency')
})

test('planner preserves parallelSafety mutable-surface behavior while allowing read-only overlap',()=>{
  const m=mission('conflict'),a=createTask(m,{objective:'a',role:'coder',category:'standard',scope:['src/auth']}),b=createTask(m,{objective:'b',role:'coder',category:'standard',scope:['src/auth/token.ts']});a.status='running'
  const old=parallelSafety(m.execution.tasks,{scope:b.scope,dependencies:b.dependencies,role:b.role});assert.equal(old.safe,false)
  let plan=planScheduling(snapshot(m));assert.equal(decision(plan,unitID(b)).disposition,'DEFERRED_CONFLICT');assert.equal(decision(plan,unitID(b)).reasons[0].code,'mutable-surface-conflict')
  plan=planScheduling(snapshot(m,{traits:{[unitID(a)]:{readOnly:true},[unitID(b)]:{readOnly:true}}}));assert.equal(decision(plan,unitID(b)).disposition,'RUNNABLE')
})

test('topology capacity is independent from provider/model resolution',()=>{
  const m=mission('topology'),a=createTask(m,{objective:'a',role:'coder',category:'standard',scope:['a']}),b=createTask(m,{objective:'b',role:'coder',category:'standard',scope:['b']}),c=createTask(m,{objective:'c',role:'coder',category:'standard',scope:['c']});a.status='running';b.status='running'
  let plan=planScheduling(snapshot(m,{global:10}));assert.equal(decision(plan,unitID(c)).disposition,'DEFERRED_CAPACITY');assert.equal(decision(plan,unitID(c)).reasons[0].code,'topology-capacity')
  m.execution.topology.parallelism=3;plan=planScheduling(snapshot(m,{global:10}));assert.equal(decision(plan,unitID(c)).disposition,'RUNNABLE')
})

test('resolved provider/model capacities preserve ConcurrencyScheduler decisions and allow shared model below cap',()=>{
  const m=mission('resource'),a=createTask(m,{objective:'a',role:'coder',category:'standard',scope:['a']}),b=createTask(m,{objective:'b',role:'coder',category:'standard',scope:['b']});m.execution.topology.parallelism=4
  const scheduler=new ConcurrencyScheduler(()=>({global:3,providers:{p:3},models:{'p/same':2}}));assert.equal(scheduler.acquire(unitID(a),'p','p/same'),true)
  const resources={[unitID(b)]:{provider:'p',model:'p/same'}},oneRunning=[{executionUnitId:unitID(a),provider:'p',model:'p/same'}]
  let plan=planScheduling(snapshot(m,{resources,global:3,providers:{p:3},models:{'p/same':2},running:oneRunning}));assert.equal(decision(plan,unitID(b)).disposition,'RUNNABLE');assert.equal(scheduler.canStart(unitID(b),'p','p/same').ok,true)
  scheduler.acquire('eu:other','p','p/same');const twoRunning=[...oneRunning,{executionUnitId:'eu:other',provider:'p',model:'p/same'}];plan=planScheduling(snapshot(m,{resources,global:3,providers:{p:3},models:{'p/same':2},running:twoRunning}));assert.equal(decision(plan,unitID(b)).disposition,'DEFERRED_CAPACITY');assert.equal(decision(plan,unitID(b)).reasons[0].code,'model-capacity');assert.equal(scheduler.canStart(unitID(b),'p','p/same').reason,'model-capacity:p/same')
})


test('conflicting queued work is deterministically ordered instead of mutually deadlocking',()=>{
  const m=mission('tie-break'),a=createTask(m,{objective:'first',role:'coder',category:'standard',scope:['src/shared']}),b=createTask(m,{objective:'second',role:'coder',category:'standard',scope:['src/shared/file.ts']})
  a.status='queued';b.status='queued';a.created_at=10;a.updated_at=10;b.created_at=20;b.updated_at=20
  const plan=planScheduling(snapshot(m))
  assert.equal(decision(plan,unitID(a)).disposition,'RUNNABLE')
  assert.equal(decision(plan,unitID(b)).disposition,'DEFERRED_CONFLICT')
  assert.deepEqual(decision(plan,unitID(b)).blockingUnitIds,[unitID(a)])
})


test('worker starting/busy lifecycle consumes topology capacity even while task status is queued',()=>{
  const m=mission('starting-capacity'),a=createTask(m,{objective:'a',role:'coder',category:'standard',scope:['a']}),b=createTask(m,{objective:'b',role:'coder',category:'standard',scope:['b']})
  m.execution.topology.parallelism=1;a.status='queued';const wa=createWorker(m,a,'p/m');wa.status='starting'
  const plan=planScheduling(snapshot(m,{global:10}))
  assert.equal(decision(plan,unitID(a)).disposition,'ACTIVE')
  assert.equal(decision(plan,unitID(b)).disposition,'DEFERRED_CAPACITY')
  assert.equal(decision(plan,unitID(b)).reasons[0].code,'topology-capacity')
})

test('blocked task fails closed instead of becoming implicitly runnable',()=>{
  const m=mission('blocked-state'),task=createTask(m,{objective:'blocked',role:'coder',category:'standard'});task.status='blocked'
  const plan=planScheduling(snapshot(m))
  assert.equal(decision(plan,unitID(task)).disposition,'BLOCKED_STATE')
  assert.equal(decision(plan,unitID(task)).reasons[0].code,'task-blocked')
})

test('global and provider resource ceilings match current ConcurrencyScheduler policy semantics',()=>{
  const m=mission('resource-ceilings'),a=createTask(m,{objective:'a',role:'coder',category:'standard',scope:['a']}),b=createTask(m,{objective:'b',role:'coder',category:'standard',scope:['b']});m.execution.topology.parallelism=8
  const resource={[unitID(b)]:{provider:'p',model:'p/b'}}
  const globalScheduler=new ConcurrencyScheduler(()=>({global:1}));globalScheduler.acquire(unitID(a),'q','q/a')
  let plan=planScheduling(snapshot(m,{resources:resource,global:1,running:[{executionUnitId:unitID(a),provider:'q',model:'q/a'}]}));assert.equal(decision(plan,unitID(b)).reasons[0].code,'global-capacity');assert.equal(globalScheduler.canStart(unitID(b),'p','p/b').reason,'global-capacity')
  const providerScheduler=new ConcurrencyScheduler(()=>({global:4,providers:{p:1}}));providerScheduler.acquire(unitID(a),'p','p/a')
  plan=planScheduling(snapshot(m,{resources:resource,global:4,providers:{p:1},running:[{executionUnitId:unitID(a),provider:'p',model:'p/a'}]}));assert.equal(decision(plan,unitID(b)).reasons[0].code,'provider-capacity');assert.equal(providerScheduler.canStart(unitID(b),'p','p/b').reason,'provider-capacity:p')
})

test('planner is side-effect-free and does not mutate graph or running capacity',()=>{
  const m=mission('pure'),task=createTask(m,{objective:'x',role:'coder',category:'standard',scope:['x']}),worker=createWorker(m,task,'p/m');worker.status='queued';task.status='queued'
  const snap=snapshot(m,{resources:{[unitID(task)]:{provider:'p',model:'p/m'}},running:[]}),before=structuredClone(snap)
  const first=planScheduling(snap),second=planScheduling(snap)
  assert.deepEqual(first,second);assert.deepEqual(snap,before)
})
