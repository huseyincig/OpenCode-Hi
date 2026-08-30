import test from 'node:test'
import assert from 'node:assert/strict'
import {lastAssistantUsage} from '../dist/opencode/client-adapter.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createTask,createWorker,beginWorkerAttempt} from '../dist/runtime/worker/worker-runtime.js'
import {bindWorkerUsageObservation,workerDerivedOpenCodeCost,workerExactTokenUsage} from '../dist/runtime/economics/usage-runtime.js'
import {isWorkerContract} from '../dist/contracts/worker.js'
import {startAssessedMission} from './helpers/semantic.mjs'

const tokens=(input,output,reasoning=0,read=0,write=0)=>({input,output,reasoning,cache:{read,write}})

test('OpenCode step-finish parts produce complete exact token usage while monetary cost remains derived',()=>{
  const usage=lastAssistantUsage([{info:{id:'m1',role:'assistant',providerID:'p',modelID:'m',time:{completed:10},cost:99,tokens:tokens(999,999)},parts:[
    {type:'step-finish',cost:.1,tokens:tokens(100,20,3,10,5)},
    {type:'step-finish',cost:.2,tokens:tokens(200,30,4,20,6)},
  ]}])
  assert.deepEqual(usage,{message_id:'m1',model_identity:'p/m',observed_at:10,token_source:'opencode-step-finish',coverage:'assistant-step-total',confidence:'exact',step_count:2,tokens:{input:300,output:50,reasoning:7,cache_read:30,cache_write:11},monetary:{usd:.30000000000000004,source:'opencode-calculated',confidence:'derived'}})
})

test('assistant-level fallback is exact reported numbers but not promoted to complete step-total coverage',()=>{
  const usage=lastAssistantUsage([{info:{id:'m2',role:'assistant',providerID:'p',modelID:'m',time:{created:11},cost:.4,tokens:tokens(120,22,5,4,3)},parts:[{type:'text',text:'ok'}]}])
  assert.equal(usage.token_source,'opencode-assistant-message');assert.equal(usage.coverage,'assistant-message-reported');assert.equal(usage.confidence,'exact')
  assert.deepEqual(usage.monetary,{usd:.4,source:'opencode-calculated',confidence:'derived'})
})

test('malformed step-finish usage fails closed instead of partially summing a message',()=>{
  assert.equal(lastAssistantUsage([{info:{role:'assistant',tokens:tokens(1,1)},parts:[{type:'step-finish',cost:.1,tokens:tokens(2,2)},{type:'step-finish',cost:.1,tokens:{input:-1}}]}]),undefined)
})

test('worker usage observation is exact-attempt bound deduplicated and contract-valid',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'usage-worker','implement',{task_kind:'implementation',likely_verification:[]})
  const task=createTask(m,{objective:'x',role:'coder',category:'standard'}),worker=createWorker(m,task,'p/m');worker.session_id='child';beginWorkerAttempt(task,worker,100);worker.status='busy'
  const host={message_id:'m1',model_identity:'p/m',observed_at:110,token_source:'opencode-step-finish',coverage:'assistant-step-total',confidence:'exact',step_count:1,tokens:{input:10,output:3,reasoning:1,cache_read:2,cache_write:0},monetary:{usd:.01,source:'opencode-calculated',confidence:'derived'}}
  const one=bindWorkerUsageObservation(m,worker,host),two=bindWorkerUsageObservation(m,worker,host)
  assert.equal(one.observation_id,two.observation_id);assert.equal(worker.usage_observations.length,1);assert.equal(isWorkerContract(worker),true)
  assert.deepEqual(workerExactTokenUsage(worker),{input:10,output:3,reasoning:1,cache_read:2,cache_write:0});assert.equal(workerDerivedOpenCodeCost(worker),.01)
  beginWorkerAttempt(task,worker,200);const next=bindWorkerUsageObservation(m,worker,{...host,message_id:'m2',observed_at:210});assert.notEqual(next.observation_id,one.observation_id);assert.equal(worker.usage_observations.length,2)
})

test('canonical usage observation stream remains append-only beyond the former 32-observation window',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'usage-append-only','implement',{task_kind:'implementation',likely_verification:[]})
  const task=createTask(m,{objective:'x',role:'coder',category:'standard'}),worker=createWorker(m,task,'p/m');worker.session_id='child';beginWorkerAttempt(task,worker,100);worker.status='busy'
  for(let i=0;i<40;i++)bindWorkerUsageObservation(m,worker,{message_id:`msg-${i}`,model_identity:'p/m',observed_at:110+i,token_source:'opencode-step-finish',coverage:'assistant-step-total',confidence:'exact',step_count:1,tokens:{input:i+1,output:1,reasoning:0,cache_read:0,cache_write:0}})
  assert.equal(worker.usage_observations.length,40)
  assert.equal(worker.usage_observations[0].message_id,'msg-0')
  assert.equal(worker.usage_observations.at(-1).message_id,'msg-39')
  assert.equal(isWorkerContract(worker),true)
  assert.deepEqual(workerExactTokenUsage(worker),{input:820,output:40,reasoning:0,cache_read:0,cache_write:0})
  const duplicate=bindWorkerUsageObservation(m,worker,{message_id:'msg-0',model_identity:'p/m',observed_at:999,token_source:'opencode-step-finish',coverage:'assistant-step-total',confidence:'exact',step_count:1,tokens:{input:999,output:999,reasoning:0,cache_read:0,cache_write:0}})
  assert.equal(duplicate.observation_id,worker.usage_observations[0].observation_id)
  assert.equal(worker.usage_observations.length,40,'deterministic dedup remains idempotent without truncation')
})
