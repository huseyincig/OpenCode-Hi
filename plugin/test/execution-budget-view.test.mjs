import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createTask,createWorker,beginWorkerAttempt} from '../dist/runtime/worker/worker-runtime.js'
import {bindWorkerUsageObservation} from '../dist/runtime/economics/usage-runtime.js'
import {executionBudgetView} from '../dist/runtime/economics/budget-view.js'
import {startAssessedMission} from './helpers/semantic.mjs'

test('budget view unifies existing hard limits without inventing monetary or token ceilings',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'budget-view','implement',{task_kind:'implementation',likely_verification:[]})
  const task=createTask(m,{objective:'x',role:'coder',category:'standard',executionProfile:{role:'coder',category:'standard',task:{objective:'x',scope:[],dependencies:[],required_evidence:[]},tools:[],fallback_models:[],methodologies:[],permission_profile:{skill_tool_enabled:false,skill_permissions:{},external_effects:'parent-only',recursive_task:'deny'},verification_policy:m.execution.verification_policy,max_context_chars:12000,max_handoff_chars:18000,max_result_chars:16000,max_artifacts:8}}),w=createWorker(m,task,'p/m');w.session_id='child';beginWorkerAttempt(task,w,100);w.status='busy'
  bindWorkerUsageObservation(m,w,{message_id:'m1',token_source:'opencode-step-finish',coverage:'assistant-step-total',confidence:'exact',step_count:1,tokens:{input:100,output:20,reasoning:5,cache_read:10,cache_write:0},monetary:{usd:.25,source:'opencode-calculated',confidence:'derived'}},200)
  const view=executionBudgetView(m,300)
  assert.equal(view.mission.find(x=>x.axis==='continuation-turns').enforcement,'hard')
  assert.equal(view.mission.find(x=>x.axis==='topology-concurrency').enforcement,'hard')
  const token=view.workers[w.id].find(x=>x.axis==='exact-complete-token-usage'),cost=view.workers[w.id].find(x=>x.axis==='opencode-derived-cost')
  assert.deepEqual([token.used,token.measurement,token.enforcement],[135,'exact','observed-only'])
  assert.deepEqual([cost.used,cost.measurement,cost.enforcement],[.25,'derived','observed-only'])
  assert.equal(view.workers[w.id].some(x=>x.axis==='provider-billed-cost'),false)
})

test('recovery strategy and continuation budgets become mechanically exhausted at their existing hard ceilings',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'budget-exhaust','implement',{task_kind:'implementation',likely_verification:[]});store.updateProgress(m,false)
  m.continuation.iteration=m.continuation.continuation_budget
  const sig=m.continuation.semantic_progress_snapshot.state_hash
  m.continuation.recovery_history=Array.from({length:5},(_,i)=>({fingerprint:`rg1:${String(i+1).padStart(8,'0')}`,level:i+1,action:['same-worker-resume','model-escalation','narrow-task','alternate-plan','fresh-worker'][i],progress_signature:sig,generation:m.continuation.generation,attempted_at:10+i,outcome:'started'}))
  const view=executionBudgetView(m)
  assert.equal(view.mission.find(x=>x.axis==='continuation-turns').status,'exhausted')
  assert.equal(view.mission.find(x=>x.axis==='semantic-recovery-strategies').status,'exhausted')
})
