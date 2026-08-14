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
  m.execution.workers.push({id,task_id:taskId,role,category,parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,model,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:`f-${id}`,status,attempt:1,started_at:started,updated_at:completed,completed_at:completed,...(retry?{fallback_history:Array.from({length:retry},(_,i)=>({from:model,to:'p/b',reason:`provider failure ${i}`,phase:'runtime',at:completed+i}))}:{})})
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

test('O3 sparse single success is insufficient confidence and does not manufacture a routing credit',()=>{
  const models=[{id:'p/a',provider:'p',quality:5,cost:.5,expectedTurns:3,contextOverhead:1,tags:['balanced']},{id:'p/b',provider:'p',quality:5,cost:.6,expectedTurns:3,contextOverhead:1,tags:['balanced']}]
  const m=mission();add(m,{id:'one',model:'p/b'})
  const f=deriveMissionModelFeedback(m,'coder','standard'),r=resolveModel('standard',models,cfg,undefined,'coder',undefined,f),b=r.scores.find(x=>x.model==='p/b')
  assert.equal(f.confidence['p/b'],'insufficient');assert.equal(b.success_credit,0);assert.equal(b.verification_adjustment,0);assert.equal(b.feedback_confidence,'insufficient')
})

test('O3 repeated failure plus retry reaches low confidence and may steer only the current bounded selection',()=>{
  const models=[{id:'p/cheap',provider:'p',quality:5,cost:.1,expectedTurns:3,contextOverhead:1,tags:['balanced']},{id:'p/robust',provider:'p',quality:5,cost:1,expectedTurns:3,contextOverhead:1,tags:['balanced']}]
  const m=mission();add(m,{id:'bad',model:'p/cheap',status:'failed',verification:'failed',retry:1})
  const f=deriveMissionModelFeedback(m,'coder','standard'),r=resolveModel('standard',models,cfg,undefined,'coder',undefined,f),cheap=r.scores.find(x=>x.model==='p/cheap')
  assert.equal(f.confidence['p/cheap'],'low');assert.equal(r.primary,'p/robust');assert.ok(cheap.failure_penalty>0);assert.ok(cheap.verification_adjustment<0);assert.equal(cheap.observed_latency_ms,100)
  assert.ok(r.reason.includes('bounded-window-model-feedback-aware'))
})
