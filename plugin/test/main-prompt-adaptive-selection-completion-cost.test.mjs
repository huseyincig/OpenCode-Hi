import test from 'node:test'
import assert from 'node:assert/strict'
import {resolveModel} from '../dist/runtime/routing/model-resolver.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'

const cfg=resolveHiConfig({routing:{strategy:'cost-quality',roleModels:{},categoryModels:{}}})

test('Smart Select optimizes expected completion cost, not raw per-call model cost',()=>{
  const models=[
    {id:'p/cheap-slow',provider:'p',quality:5,cost:.2,expectedTurns:10,contextOverhead:1,tags:['balanced']},
    {id:'p/pricier-fast',provider:'p',quality:5,cost:.5,expectedTurns:2,contextOverhead:1,tags:['balanced']},
  ]
  const r=resolveModel('standard',models,cfg)
  assert.equal(r.primary,'p/pricier-fast')
  const cheap=r.scores.find(x=>x.model==='p/cheap-slow'),fast=r.scores.find(x=>x.model==='p/pricier-fast')
  assert.ok(fast.expected_completion_cost<cheap.expected_completion_cost)
  assert.ok(r.reason.includes('expected-completion-cost-aware'))
})

test('current-mission failure/retry history penalizes a cheap repeatedly failing model',()=>{
  const models=[
    {id:'p/cheap',provider:'p',quality:5,cost:.1,expectedTurns:3,contextOverhead:1,tags:['balanced']},
    {id:'p/robust',provider:'p',quality:5,cost:1,expectedTurns:3,contextOverhead:1,tags:['balanced']},
  ]
  assert.equal(resolveModel('standard',models,cfg).primary,'p/cheap')
  const r=resolveModel('standard',models,cfg,undefined,'coder',undefined,{failures:{'p/cheap':2},retries:{'p/cheap':1}})
  assert.equal(r.primary,'p/robust')
  const cheap=r.scores.find(x=>x.model==='p/cheap')
  assert.ok(cheap.failure_penalty>0)
  assert.ok(r.reason.includes('current-mission-failure-history-aware'))
})

test('TaskRuntime feeds current mission worker failure history into the next Smart Select decision',async()=>{
  const created=[];let n=0
  const client={session:{
    create:async req=>{const id=`c${++n}`;created.push(req);return{data:{id}}},
    promptAsync:async()=>({data:{}}),abort:async()=>({data:{}}),diff:async()=>({data:[]}),
  }}
  const models=[
    {id:'p/cheap',provider:'p',quality:5,cost:.1,expectedTurns:3,contextOverhead:1,tags:['balanced']},
    {id:'p/robust',provider:'p',quality:5,cost:1,expectedTurns:3,contextOverhead:1,tags:['balanced']},
  ]
  const runtime=new TaskRuntime(client,new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:3,providers:{p:3},models:{}})),process.cwd(),process.cwd(),()=>cfg,()=>models,()=>({}))
  const m=new MissionStore(process.cwd()).start('s','implement a standard change')
  m.workers.push({id:'old',task_id:'old-task',role:'coder',category:'standard',parent_session_id:'s',parent_mission_id:m.mission_id,model:'p/cheap',fallbacks:['p/robust'],loaded_skills:[],methodologies:[],fingerprint:'old-f',status:'failed',last_runtime_failure_kind:'provider-transport',fallback_history:[{from:'p/cheap',to:'p/robust',reason:'runtime fallback after provider transport; failure=provider-transport',phase:'runtime',at:Date.now()}]})
  m.tasks.push({id:'old-task',objective:'old attempt',status:'failed',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],worker_id:'old',created_at:Date.now(),updated_at:Date.now()})
  const out=await runtime.start(m,{objective:'continue implementation on another bounded task',role:'coder',category:'standard',scope:['src/new.ts']})
  assert.equal(out.model,'p/robust')
  assert.ok(created[0].body.model.id==='robust')
  const scoreEvent=[...m.ledger].reverse().find(e=>e.type==='model.scored')
  assert.ok(scoreEvent)
  assert.ok(scoreEvent.payload.feedback.failures['p/cheap']>=1)
})
