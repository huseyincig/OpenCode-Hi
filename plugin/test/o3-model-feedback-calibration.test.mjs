import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {deriveMissionModelFeedback,missionModelFeedbackObservations} from '../dist/runtime/routing/model-feedback.js'
import {resolveModel} from '../dist/runtime/routing/model-resolver.js'
import {resolveHiConfig} from '../dist/config/resolver.js'

const cfg=resolveHiConfig({routing:{strategy:'cost-quality',roleModels:{},categoryModels:{}}})
function mission(){const store=new MissionStore(process.cwd());return startAssessedMission(store,`o3-${Math.random()}`,'bounded model feedback',{task_kind:'implementation',required_capabilities:['implementation']})}
function add(m,{id,model='p/a',role='coder',category='standard',status='completed',started=100,completed=200,retry=0,verification='passed'}){
  const taskId=`t-${id}`
  m.execution.tasks.push({id:taskId,mission_id:m.identity.mission_id,objective:id,status:status==='completed'?'completed':'failed',role,category,scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],external_action_requirements:[],worker_id:id,created_at:started,updated_at:completed,result:{status:status==='completed'?'DONE':'FAILED',summary:id,changed_files:[],evidence:verification==='not-observed'?[]:[{kind:'targeted-tests',summary:'proof',pass:verification==='passed',outcome:verification}],open_issues:[],needs_context:[]}})
  m.execution.workers.push({id,task_id:taskId,role,category,parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,model,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:`f-${id}`,status,attempt:1,generation_at_spawn:m.continuation.generation,started_at:started,updated_at:completed,completed_at:completed,...(retry?{fallback_history:Array.from({length:retry},(_,i)=>({from:model,to:'p/b',reason:`provider failure ${i}`,phase:'runtime',at:completed+i}))}:{})})
  if(verification!=='not-observed')m.execution.evidence.items.push({id:`ev-${id}`,kind:'targeted-tests',summary:'canonical proof',scope:[],source:`worker:${id}`,source_session_id:`s-${id}`,source_state_hash:'a'.repeat(64),task_id:taskId,obligation_ids:[],producer_attempt:{worker_id:id,execution_unit_id:`eu:${taskId}`,attempt_id:`eu:${taskId}:g${m.continuation.generation}:a1`,run_id:`worker:${id}:g${m.continuation.generation}:a1`,ordinal:1,generation:m.continuation.generation},observed_at:completed,pass:verification==='passed',outcome:verification})
}

test('O3 feedback is role/category scoped and bounded to the newest 12 terminal workers',()=>{
  const m=mission();for(let i=0;i<14;i++)add(m,{id:`c${i}`,completed:200+i,started:100+i});add(m,{id:'review',role:'qa-reviewer',model:'p/reviewer',completed:999})
  const rows=missionModelFeedbackObservations(m,'coder','standard')
  assert.equal(rows.length,12);assert.ok(rows.every(x=>x.role==='coder'&&x.category==='standard'));assert.equal(rows[0].observed_at,213);assert.equal(rows.at(-1).observed_at,202)
})

test('O3 derives observed latency and verification outcome without raw payload or permanent reputation',()=>{
  const m=mission();add(m,{id:'a',model:'p/a',started:100,completed:350,verification:'passed'});add(m,{id:'b',model:'p/a',started:400,completed:550,verification:'failed',status:'failed',retry:1})
  const f=deriveMissionModelFeedback(m,'coder','standard')
  assert.equal(f.samples['p/a'],2);assert.equal(f.average_latency_ms['p/a'],200);assert.equal(f.verification_passes['p/a'],1);assert.equal(f.verification_failures['p/a'],1);assert.equal(f.retries['p/a'],1);assert.equal(f.confidence['p/a'],'low');assert.equal(f.window_size,2)
})

test('O3 sparse success remains telemetry-only and cannot manufacture routing authority',()=>{
  const models=[{id:'p/code',provider:'p',quality:1,cost:50,tags:['coding']},{id:'p/b',provider:'p',quality:100,cost:.01,tags:['balanced']}]
  const m=mission();add(m,{id:'one',model:'p/b'})
  const f=deriveMissionModelFeedback(m,'coder','standard'),r=resolveModel('standard',models,cfg,undefined,'coder',undefined,f)
  assert.equal(f.confidence['p/b'],'insufficient');assert.equal(r.primary,'p/code');assert.equal('scores' in r,false)
  assert.ok(r.reason.includes('cost/quality/feedback are not routing authority'))
})

test('O3 failed sample plus retry remains observable without changing capability routing',()=>{
  const models=[{id:'p/code',provider:'p',tags:['coding']},{id:'p/generic',provider:'p',tags:['balanced']}]
  const m=mission();add(m,{id:'bad',model:'p/code',status:'failed',verification:'failed',retry:1})
  const f=deriveMissionModelFeedback(m,'coder','standard'),r=resolveModel('standard',models,cfg,undefined,'coder',undefined,f)
  assert.equal(f.samples['p/code'],1);assert.equal(f.retries['p/code'],1);assert.equal(f.confidence['p/code'],'insufficient');assert.equal(f.average_latency_ms['p/code'],100)
  assert.equal(r.primary,'p/code');assert.ok(r.reason.includes('cost/quality/feedback are not routing authority'))
})

test('O3 repeated failures may reach confidence for analysis but still cannot silently reroute',()=>{
  const models=[{id:'p/code',provider:'p',tags:['coding']},{id:'p/other',provider:'p',tags:['coding']}]
  const m=mission();add(m,{id:'bad1',model:'p/code',status:'failed',verification:'failed'});add(m,{id:'bad2',model:'p/code',status:'failed',verification:'failed',completed:300})
  const f=deriveMissionModelFeedback(m,'coder','standard'),r=resolveModel('standard',models,cfg,undefined,'coder',undefined,f)
  assert.equal(f.samples['p/code'],2);assert.equal(f.confidence['p/code'],'low');assert.equal(f.verification_failures['p/code'],2)
  assert.equal(r.primary,'p/code','feedback confidence is analysis data, not user-preference authority')
  assert.equal('scores' in r,false)
})


test('O3 fallback failure is attributed to the failed from-model while final success remains with the model that completed',()=>{
  const m=mission()
  add(m,{id:'final',model:'p/robust',verification:'passed'})
  m.execution.workers[0].fallback_history=[{from:'p/cheap',to:'p/robust',reason:'provider failure',phase:'runtime',at:150}]
  const f=deriveMissionModelFeedback(m,'coder','standard')
  assert.equal(f.successes['p/robust'],1)
  assert.equal(f.failures['p/cheap'],1)
  assert.equal(f.retries['p/cheap'],1)
  assert.equal(f.samples['p/cheap'],1)
  assert.equal(f.confidence['p/cheap'],'insufficient','one failed attempt is still one sample; retry count must not manufacture confidence')
  assert.equal(f.verification_passes['p/robust'],1)
})

test('O3 invalidated or wrong-attempt evidence does not become model verification credit',()=>{
  const m=mission();add(m,{id:'attempt',model:'p/a',verification:'passed'})
  const item=m.execution.evidence.items.at(-1);item.producer_attempt={...item.producer_attempt,attempt_id:`eu:${item.task_id}:g${m.continuation.generation}:a2`,run_id:`worker:attempt:g${m.continuation.generation}:a2`,ordinal:2}
  const f=deriveMissionModelFeedback(m,'coder','standard')
  assert.equal(f.verification_passes['p/a']??0,0)
  assert.equal(missionModelFeedbackObservations(m,'coder','standard')[0].verification_outcome,'not-observed')
})
