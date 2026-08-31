import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { startAssessedMission } from './helpers/semantic.mjs'
import { modelIntelligenceView } from '../dist/runtime/model-intelligence/runtime.js'

function mission(){return startAssessedMission(new MissionStore(process.cwd()),`mi-${Math.random()}`,'inspect model intelligence',{task_kind:'analysis',required_capabilities:['analysis']})}
function worker(m){
  const w={id:'w1',task_id:'t1',role:'coder',category:'standard',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,model:'p/a',effective_model:'p/a',fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f1',status:'completed',attempt:1,generation_at_spawn:m.continuation.generation,started_at:100,updated_at:200,completed_at:200,usage_observations:[
    {observation_id:'obs1',worker_id:'w1',execution_unit_id:'eu:t1',attempt_ordinal:1,generation:m.continuation.generation,source_session_id:'s1',message_id:'m1',model_identity:'p/a',token_source:'opencode-step-finish',coverage:'assistant-step-total',confidence:'exact',step_count:1,tokens:{input:10,output:2,reasoning:1,cache_read:3,cache_write:0},monetary:{usd:.01,source:'opencode-calculated',confidence:'derived'},observed_at:150},
    {observation_id:'obs2',worker_id:'w1',execution_unit_id:'eu:t1',attempt_ordinal:1,generation:m.continuation.generation,source_session_id:'s1',message_id:'m2',model_identity:'p/a',token_source:'opencode-assistant-message',coverage:'assistant-message-reported',confidence:'exact',step_count:1,tokens:{input:99,output:99,reasoning:99,cache_read:99,cache_write:99},monetary:{usd:.02,source:'provider-billed',confidence:'exact'},observed_at:160},
  ]}
  m.execution.workers.push(w)
  return w
}

test('Model Intelligence is an observed-only derived view over live inventory and canonical worker usage',()=>{
  const m=mission();worker(m);const live=[{id:'p/a',provider:'p',tags:['coding']}]
  const view=modelIntelligenceView(m,live,'coder','standard')
  assert.equal(view.inventory.source,'opencode-live');assert.deepEqual(view.inventory.models,live);assert.notStrictEqual(view.inventory.models,live)
  assert.equal(view.feedback.authority,'advisory-only')
  assert.equal(view.usage.claim_boundary,'observed-only')
  const usage=view.usage.models[0];assert.equal(usage.observations,2);assert.equal(usage.complete_step_observations,1);assert.equal(usage.partial_message_observations,1)
  assert.deepEqual(usage.exact_step_tokens,{input:10,output:2,reasoning:1,cache_read:3,cache_write:0},'partial assistant-message reports must not inflate exact step totals')
  assert.equal(usage.opencode_derived_cost_usd,.01);assert.equal(usage.provider_billed_cost_usd,.02)
})

test('Model Intelligence does not invent inventory, usage, or persistence when observations are absent',()=>{
  const m=mission(),view=modelIntelligenceView(m,[],'coder','standard')
  assert.deepEqual(view.inventory.models,[]);assert.deepEqual(view.usage.models,[]);assert.equal(view.feedback.value.window_size,0)
  assert.equal('persist' in view,false);assert.equal('recommend' in view,false);assert.equal('route' in view,false)
})
