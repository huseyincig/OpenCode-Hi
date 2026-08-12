import test from 'node:test'
import assert from 'node:assert/strict'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'

function setup(promptImpl=async()=>{}){
  const calls=[]
  const client={session:{promptAsync:async arg=>{calls.push(arg);return promptImpl(arg)},abort:async()=>{}}}
  const scheduler=new ConcurrencyScheduler(()=>({global:4,providers:{},models:{}}))
  const runtime=new TaskRuntime(client,new BackgroundRegistry(),scheduler,process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
  const store=new MissionStore(process.cwd())
  const m=store.start('parent','fix provider fallback')
  m.tasks.push({id:'t1',objective:'fix it',status:'running',role:'coder',category:'standard',scope:['src/a.ts'],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],execution_profile:{role:'coder',category:'standard',model:'p/primary',fallback_models:['p/fallback1','p/fallback2'],fallback_variants:{'p/fallback1':'high','p/fallback2':'medium'},skills:[],permission_profile:{skill_tool_enabled:true,skill_permissions:{},external_effects:'parent-only',recursive_task:'deny'},verification_policy:m.verification_policy,max_context_chars:1000,max_handoff_chars:1000,max_result_chars:1000,max_artifacts:4},worker_id:'w1',created_at:Date.now(),updated_at:Date.now()})
  m.workers.push({id:'w1',task_id:'t1',role:'coder',category:'standard',session_id:'child1',parent_session_id:'parent',parent_mission_id:m.mission_id,model:'p/primary',fallbacks:['p/fallback1','p/fallback2'],loaded_skills:[],methodologies:[],fingerprint:'f',status:'busy',generation_at_spawn:m.generation})
  scheduler.acquire('w1','p','p/primary')
  return {runtime,scheduler,m,calls}
}

test('provider failure uses same session and first fallback without stagnation',async()=>{
  const {runtime,m,calls}=setup()
  m.stagnation_count=4
  assert.equal(await runtime.recoverRuntimeFailure(m,'w1','429 upstream rate limit'),true)
  const w=m.workers[0]
  assert.equal(w.session_id,'child1')
  assert.equal(w.model,'p/fallback1')
  assert.equal(w.runtime_recovery_pending,true)
  assert.equal(w.runtime_recovery_attempt,1)
  assert.equal(calls.length,1)
  assert.deepEqual(calls[0].body.model,{providerID:'p',modelID:'fallback1'})
  assert.equal(m.stagnation_count,4,'provider failure does not increment reasoning stagnation')
})

test('second provider failure advances to next fallback rather than returning to prior model',async()=>{
  const {runtime,m,calls}=setup()
  assert.equal(await runtime.recoverRuntimeFailure(m,'w1','503 provider unavailable'),true)
  m.workers[0].runtime_recovery_pending=false
  assert.equal(await runtime.recoverRuntimeFailure(m,'w1','network timeout'),true)
  assert.equal(m.workers[0].model,'p/fallback2')
  assert.equal(m.workers[0].runtime_recovery_attempt,2)
  assert.deepEqual(calls.map(x=>x.body.model.modelID),['fallback1','fallback2'])
})

test('exhausted fallback chain becomes provider-failure blocker and resets stagnation',async()=>{
  const {runtime,m}=setup()
  m.workers[0].model='p/fallback2'
  m.workers[0].fallbacks=[]
  m.stagnation_count=5
  assert.equal(await runtime.recoverRuntimeFailure(m,'w1','429 quota exceeded'),false)
  assert.equal(m.workers[0].runtime_fallback_exhausted,true)
  assert.equal(m.stagnation_count,0)
  assert.equal(m.tasks[0].status,'blocked')
  assert.match(m.tasks[0].result.open_issues[0],/^provider-failure:provider-transport:/)
  assert.ok(m.blockers.some(x=>x.startsWith('provider-failure:provider-transport:')))
})
