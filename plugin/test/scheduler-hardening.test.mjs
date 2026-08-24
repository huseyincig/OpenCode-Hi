import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {evaluateIdle} from '../dist/runtime/continuation/evaluator.js'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { createConcurrencyPolicySource } from '../dist/runtime/scheduler/concurrency.js'
import { evaluateSchedulingResourceCapacity } from '../dist/runtime/scheduler/planner.js'
import { parallelSafety } from '../dist/runtime/scheduler/parallel-safety.js'
import { createTask } from '../dist/runtime/worker/worker-runtime.js'
import { resolveHiConfig } from '../dist/config/resolver.js'
import {opencodeChildPort} from './helpers/host-port.mjs'

function client(){let n=0;return {session:{create:async()=>({data:{id:`child-${++n}`}}),promptAsync:async()=>{}}}}
function runtime(scheduler=createConcurrencyPolicySource(()=>({global:4}))){return new TaskRuntime(opencodeChildPort(client()),new BackgroundRegistry(),scheduler,process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[{id:'p/code',provider:'p',quality:8,cost:1,tags:['coding','balanced']}],()=>({}))}

test('dedupe fingerprint preserves distinct task contracts with same objective/role/model',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'sched-dedupe','opaque parallel work');m.execution.execution_mode='parallel'
  const r=runtime()
  const a=await r.start(m,{objective:'apply compatibility fix',role:'coder',category:'standard',scope:['src/a.ts']})
  const b=await r.start(m,{objective:'apply compatibility fix',role:'coder',category:'standard',scope:['src/b.ts']})
  assert.notEqual(a.worker_id,b.worker_id)
  assert.notEqual(a.task_id,b.task_id)
  assert.equal(m.execution.workers.length,2)
  assert.equal(m.execution.tasks.length,2)
})


test('mission-isolated identity still serializes cross-mission writers that share the same project surface',async()=>{
  const registry=new BackgroundRegistry(),created=[]
  let releaseFirst
  const firstGate=new Promise(resolve=>{releaseFirst=resolve})
  let n=0
  const c={session:{
    create:async req=>{const id=`cross-mission-child-${++n}`;created.push({id,req});if(n===1)await firstGate;return{data:{id}}},
    promptAsync:async()=>({data:{}}),
    abort:async()=>({data:true}),
    diff:async()=>({data:[]}),
  }}
  const store=new MissionStore(),a=startAssessedMission(store,'dedupe-mission-a','opaque implementation',{task_kind:'implementation',scope:'local',required_capabilities:['implementation'],likely_targets:['src/shared.ts']}),b=startAssessedMission(store,'dedupe-mission-b','opaque implementation',{task_kind:'implementation',scope:'local',required_capabilities:['implementation'],likely_targets:['src/shared.ts']})
  const rt=new TaskRuntime(opencodeChildPort(c),registry,createConcurrencyPolicySource(()=>({global:4})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[{id:'p/code',provider:'p',quality:8,cost:1,tags:['coding','balanced'],writeCapable:true}],()=>({}),undefined,[],undefined,undefined,undefined,undefined,undefined,undefined,undefined,()=>store.all())
  const pa=rt.start(a,{objective:'apply identical fix',role:'coder',category:'standard',scope:['src/shared.ts']})
  while(created.length<1)await new Promise(resolve=>setImmediate(resolve))
  const rb=await rt.start(b,{objective:'apply identical fix',role:'coder',category:'standard',scope:['src/shared.ts']})
  assert.equal(rb.readiness,'WAIT');assert.equal(created.length,1,'peer writer must not spawn while conflicting project surface is active')
  releaseFirst();const ra=await pa
  assert.notEqual(ra.worker_id,rb.worker_id);assert.notEqual(ra.task_id,rb.task_id)
  assert.equal(a.execution.workers.some(w=>w.id===rb.worker_id),false);assert.equal(b.execution.workers.some(w=>w.id===ra.worker_id),false)
  assert.equal(await rt.cancel(a,ra.worker_id),true);await new Promise(resolve=>setImmediate(resolve))
  assert.equal(created.length,2,'queued peer writer starts after the prior project writer releases ownership')
})

test('parallel safety blocks parent/child write surfaces, not just exact path equality',()=>{
  const existing=[{id:'t1',objective:'x',status:'running',role:'coder',category:'standard',scope:['src/auth'],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],created_at:1,updated_at:1}]
  const decision=parallelSafety(existing,{scope:['src/auth/token.ts'],dependencies:[],role:'coder'})
  assert.equal(decision.safe,false)
  assert.match(decision.reasons.join('|'),/write-scope-overlap/)
})

test('parallel safety allows independent siblings that share an already-completed prerequisite',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'shared-prereq','opaque siblings')
  const pre=createTask(m,{objective:'discover',role:'repository-explorer',category:'quick'});pre.status='completed'
  const a=createTask(m,{objective:'change a',role:'coder',category:'standard',scope:['src/a.ts'],dependencies:[pre.id]});a.status='running'
  const decision=parallelSafety(m.execution.tasks,{scope:['src/b.ts'],dependencies:[pre.id],role:'coder'})
  assert.equal(decision.safe,true,decision.reasons.join('; '))
})

test('unknown dependency IDs fail preflight instead of queueing forever',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'unknown-dep','opaque work')
  await assert.rejects(()=>runtime().start(m,{objective:'do work',role:'coder',dependencies:['t-does-not-exist']}),/Unknown task dependencies/)
  assert.equal(m.execution.tasks.length,0)
  assert.equal(m.execution.workers.length,0)
})

test('model rebind cannot oversubscribe target model capacity',()=>{
  const base={topology:3,global:3,providers:{p:3},models:{'p/cheap':3,'p/strong':1},running:[{executionUnitId:'w1',provider:'p',model:'p/cheap'},{executionUnitId:'w2',provider:'p',model:'p/strong'}]}
  const blocked=evaluateSchedulingResourceCapacity(base,'w1',{provider:'p',model:'p/strong'})
  assert.equal(blocked.ok,false);assert.equal(blocked.reason?.code,'model-capacity');assert.equal(blocked.reason?.detail,'p/strong')
  const afterRelease={...base,running:base.running.filter(x=>x.executionUnitId!=='w2')}
  const admitted=evaluateSchedulingResourceCapacity(afterRelease,'w1',{provider:'p',model:'p/strong'})
  assert.equal(admitted.ok,true,'current unit is excluded while evaluating its target rebind capacity')
})

test('queued dependent is removed from queue when prerequisite fails',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'dep-fail-queue','opaque dependency work');m.execution.execution_mode='parallel'
  const pre=createTask(m,{objective:'prerequisite',role:'coder',category:'standard',scope:['src/pre.ts']});pre.status='running'
  const r=runtime()
  const dependent=await r.start(m,{objective:'dependent',role:'coder',category:'standard',scope:['src/dep.ts'],dependencies:[pre.id]})
  assert.equal(r.queueDepth(),1)
  assert.equal(m.execution.tasks.find(t=>t.id===dependent.task_id)?.status,'queued')
  pre.status='failed'
  // Trigger the runtime's normal queue drain path through failure of a real worker.
  const triggerTask=createTask(m,{objective:'trigger',role:'coder',category:'standard',scope:['src/trigger.ts']})
  const { createWorker } = await import('../dist/runtime/worker/worker-runtime.js')
  const triggerWorker=createWorker(m,triggerTask,'p/code');triggerWorker.status='busy';triggerTask.status='running'
  r.fail(m,triggerWorker.id,'synthetic trigger failure')
  await new Promise(resolve=>setImmediate(resolve))
  const depTask=m.execution.tasks.find(t=>t.id===dependent.task_id),depWorker=m.execution.workers.find(w=>w.id===dependent.worker_id)
  assert.equal(r.queueDepth(),0)
  assert.equal(depTask?.status,'blocked')
  assert.equal(depWorker?.status,'failed')
  assert.match(depTask?.result?.open_issues?.[0]??'',/dependency-unavailable/)
  const decision=evaluateIdle(m);assert.equal(decision.decision,'USER_ACTION_REQUIRED');assert.equal(decision.reason_code,'operational-blocker');assert.match(decision.reason,/^dependency-unavailable:/)
})

test('start rejects a dependency that is already failed/cancelled',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'dep-fail-preflight','opaque dependency work')
  const pre=createTask(m,{objective:'prerequisite',role:'coder',category:'standard'});pre.status='failed'
  await assert.rejects(()=>runtime().start(m,{objective:'dependent',role:'coder',dependencies:[pre.id]}),/Unavailable task dependencies/)
})


test('legacy parallel safety also serializes unknown writer surfaces but not two read-only unknown surfaces',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'unknown-surface-parallel-safety','opaque parallel safety')
  const writer=createTask(m,{objective:'unknown writer',role:'coder',category:'standard',scope:[]});writer.status='running'
  const blocked=parallelSafety(m.execution.tasks,{scope:[],dependencies:[],role:'coder'})
  assert.equal(blocked.safe,false);assert.match(blocked.reasons.join('|'),/unknown-mutable-surface/)
  writer.role='repository-explorer'
  const readOnly=parallelSafety(m.execution.tasks,{scope:[],dependencies:[],role:'architect'})
  assert.equal(readOnly.safe,true,readOnly.reasons.join('; '))
})
