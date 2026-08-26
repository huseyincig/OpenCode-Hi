import test from 'node:test'
import assert from 'node:assert/strict'
import {resolveModel} from '../dist/runtime/routing/model-resolver.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {deriveMissionModelFeedback} from '../dist/runtime/routing/model-feedback.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {opencodeChildPort} from './helpers/host-port.mjs'

const cfg=resolveHiConfig({routing:{roleModels:{},categoryModels:{}}})

test('automatic routing is capability-first and does not optimize heuristic completion cost',()=>{
  const models=[
    {id:'p/cheap-generic',provider:'p',quality:100,cost:.01,expectedTurns:1,contextOverhead:.1,tags:['balanced']},
    {id:'p/code',provider:'p',quality:1,cost:10,expectedTurns:10,contextOverhead:5,tags:['coding']},
  ]
  const r=resolveModel('standard',models,cfg,undefined,'coder')
  assert.equal(r.primary,'p/code')
  assert.equal('scores' in r,false)
  assert.ok(r.reason.includes('capability-priority:coding'))
  assert.ok(r.reason.includes('cost/quality/feedback are not routing authority'))
})

test('bounded model feedback remains useful telemetry but cannot silently reroute the next task',()=>{
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'feedback-telemetry','implement a standard change',{task_kind:'implementation',required_capabilities:['implementation']})
  const now=Date.now()
  for(const [i,id] of ['old-a','old-b'].entries()){
    const taskId=`${id}-task`,at=now-i
    m.execution.workers.push({id,task_id:taskId,role:'coder',category:'standard',parent_session_id:'feedback-telemetry',parent_mission_id:m.identity.mission_id,model:'p/code',fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:`${id}-f`,status:'failed',attempt:1,generation_at_spawn:m.continuation.generation,updated_at:at,completed_at:at,last_runtime_failure_kind:'provider-transport'})
    m.execution.tasks.push({id:taskId,mission_id:m.identity.mission_id,objective:'old failed attempt',status:'failed',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],external_action_requirements:[],gate_ids:[],worker_id:id,created_at:at,updated_at:at})
  }
  const feedback=deriveMissionModelFeedback(m,'coder','standard')
  assert.ok((feedback.failures?.['p/code']??0)>=2)
  const models=[{id:'p/code',provider:'p',tags:['coding']},{id:'p/generic',provider:'p',tags:['balanced']}]
  const selected=resolveModel('standard',models,cfg,undefined,'coder',undefined,feedback)
  assert.equal(selected.primary,'p/code')
  assert.equal('scores' in selected,false)
})

test('TaskRuntime no longer emits model-scoring authority from mission feedback',async()=>{
  const created=[];let n=0
  const client={session:{
    create:async req=>{const id=`c${++n}`;created.push(req);return{data:{id}}},
    promptAsync:async()=>({data:{}}),abort:async()=>({data:true}),diff:async()=>({data:[]}),
  }}
  const models=[{id:'p/code',provider:'p',tags:['coding']},{id:'p/generic',provider:'p',tags:['balanced']}]
  const runtime=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:3,providers:{p:3},models:{}})),process.cwd(),process.cwd(),()=>cfg,()=>models,()=>({}))
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'runtime-no-score','implement a standard change',{task_kind:'implementation',required_capabilities:['implementation']})
  const out=await runtime.start(m,{objective:'implement one bounded file',role:'coder',category:'standard',scope:['src/new.ts']})
  assert.equal(out.model,'p/code')
  assert.equal(created[0].body.model.id,'code')
  assert.equal(m.execution.ledger.some(e=>e.type==='model.scored'),false)
  assert.ok(m.execution.workers.find(w=>w.id===out.worker_id)?.model_selection_reason?.includes('cost/quality/feedback are not routing authority'))
})
