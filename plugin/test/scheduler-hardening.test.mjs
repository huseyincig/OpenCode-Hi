import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { ConcurrencyScheduler } from '../dist/runtime/scheduler/concurrency.js'
import { parallelSafety } from '../dist/runtime/scheduler/parallel-safety.js'
import { createTask } from '../dist/runtime/worker/worker-runtime.js'
import { resolveHiConfig } from '../dist/config/resolver.js'

function client(){let n=0;return {session:{create:async()=>({data:{id:`child-${++n}`}}),promptAsync:async()=>{}}}}
function runtime(scheduler=new ConcurrencyScheduler(()=>({global:4}))){return new TaskRuntime(client(),new BackgroundRegistry(),scheduler,process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[{id:'p/code',provider:'p',quality:8,cost:1,tags:['coding','balanced']}],()=>({}))}

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
  const scheduler=new ConcurrencyScheduler(()=>({global:3,providers:{p:3},models:{'p/cheap':3,'p/strong':1}}))
  assert.equal(scheduler.acquire('w1','p','p/cheap'),true)
  assert.equal(scheduler.acquire('w2','p','p/strong'),true)
  const move=scheduler.canStart('w1','p','p/strong')
  assert.equal(move.ok,false)
  assert.equal(move.reason,'model-capacity:p/strong')
  assert.equal(scheduler.acquire('w1','p','p/strong'),false)
  assert.equal(scheduler.running(),2)
  scheduler.release('w2')
  assert.equal(scheduler.acquire('w1','p','p/strong'),true)
  assert.equal(scheduler.running(),1,'rebind must keep one slot for the same worker')
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
})

test('start rejects a dependency that is already failed/cancelled',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'dep-fail-preflight','opaque dependency work')
  const pre=createTask(m,{objective:'prerequisite',role:'coder',category:'standard'});pre.status='failed'
  await assert.rejects(()=>runtime().start(m,{objective:'dependent',role:'coder',dependencies:[pre.id]}),/Unavailable task dependencies/)
})
