import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createTask,createWorker,beginWorkerAttempt} from '../dist/runtime/worker/worker-runtime.js'
import {bindWorkerUsageObservation} from '../dist/runtime/economics/usage-runtime.js'
import {appendLedger} from '../dist/runtime/ledger/ledger.js'
import {observabilityEconomicsView} from '../dist/runtime/observability/runtime.js'
import {startAssessedMission} from './helpers/semantic.mjs'

function fixture(){const m=startAssessedMission(new MissionStore(),'obs','implement',{task_kind:'implementation',likely_verification:[]}),task=createTask(m,{objective:'x',role:'coder',category:'standard'}),w=createWorker(m,task,'p/m');w.session_id='child';w.status='busy';return{m,task,w}}
const usage=(id,coverage='assistant-step-total')=>({message_id:id,model_identity:'p/m',token_source:coverage==='assistant-step-total'?'opencode-step-finish':'opencode-assistant-message',coverage,confidence:'exact',step_count:1,tokens:{input:10,output:2,reasoning:1,cache_read:3,cache_write:0},monetary:{usd:.02,source:'opencode-calculated',confidence:'derived'}})

test('observability economics view is bounded derived state with explicit authority boundaries',()=>{
  const {m,task,w}=fixture();beginWorkerAttempt(task,w,100);bindWorkerUsageObservation(m,w,usage('a'),110);beginWorkerAttempt(task,w,200);appendLedger(m,'worker.resumed',{task_id:task.id,worker_id:w.id});bindWorkerUsageObservation(m,w,usage('b','assistant-message-reported'),210)
  const view=observabilityEconomicsView(m,300)
  assert.equal(view.claim_boundary,'derived-from-canonical-worker-usage+mission-ledger');assert.equal(view.routing_authority,false);assert.equal(view.completion_authority,false);assert.equal(view.persistence_owner,'none-derived-view')
  assert.equal(view.usage.coverage,'mixed');assert.equal(view.usage.complete_observations,1);assert.equal(view.usage.partial_observations,1)
  assert.deepEqual(view.usage.exact_complete_tokens,{input:10,output:2,reasoning:1,cache_read:3,cache_write:0})
  assert.equal(view.usage.causal.partial_observations,1);assert.equal(view.usage.causal.cache_repayment,'unavailable-without-per-turn-prefix-and-ttl-evidence')
  assert.equal(view.workers.length,1);assert.equal('usage_observations' in view.workers[0],false);assert.equal('ledger' in view,false)
})

test('partial-only observations never become exact complete totals or exact economics',()=>{
  const {m,task,w}=fixture();beginWorkerAttempt(task,w,100);bindWorkerUsageObservation(m,w,usage('p','assistant-message-reported'),110)
  const view=observabilityEconomicsView(m,200)
  assert.equal(view.usage.coverage,'partial-only');assert.deepEqual(view.usage.exact_complete_tokens,{input:0,output:0,reasoning:0,cache_read:0,cache_write:0});assert.equal(view.usage.partial_observations,1)
})

test('operator worker projection is bounded without truncating canonical worker state',()=>{
  const m=startAssessedMission(new MissionStore(),'obs-bound','implement',{task_kind:'implementation',likely_verification:[]})
  for(let i=0;i<40;i++){const t=createTask(m,{objective:String(i),role:'coder',category:'standard'}),w=createWorker(m,t,'p/m');w.status='completed'}
  const view=observabilityEconomicsView(m)
  assert.equal(m.execution.workers.length,40);assert.equal(view.workers.length,32);assert.equal(view.workers[0].worker_id,m.execution.workers[8].id)
})
