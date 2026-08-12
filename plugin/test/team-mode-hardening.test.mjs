import test from 'node:test'
import assert from 'node:assert/strict'
import { TeamRuntime } from '../dist/runtime/team/team-runtime.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'

function harness(overrides={}){
  const calls={start:[],cancel:[]}
  let seq=0
  const tasks={
    start: async (m,input)=>{const id=`w${++seq}`;calls.start.push({id,input});m.tasks.push({id:`t${seq}`,objective:input.objective,role:input.role,category:input.category,status:'running',dependencies:[],constraints:input.constraints??[],obligation_ids:[],required_evidence:[],created_at:Date.now(),updated_at:Date.now(),worker_id:id});m.workers.push({id,task_id:`t${seq}`,parent_session_id:m.session_id,parent_mission_id:m.mission_id,role:input.role,category:input.category,model:input.model??'host-default',fallbacks:[],status:'busy',fingerprint:id,generation_at_spawn:m.generation,created_at:Date.now(),write_set:[]});return{worker_id:id}},
    cancel: async (m,id)=>{calls.cancel.push(id);const w=m.workers.find(x=>x.id===id);if(w)w.status='cancelled';return true},
    ...overrides,
  }
  const limits={maxMembers:4,maxMessages:4,maxWallMs:1000,maxTurns:4}
  const teams=new TeamRuntime(tasks,()=>true,()=>limits)
  const store=new MissionStore(),m=store.start(`s-${Math.random()}`,'team objective')
  return{teams,m,calls,limits}
}

test('expired team is terminal before member cancellation and all members are cancelled', async()=>{
  let observedStatus
  const h=harness({cancel:async(m,id)=>{const t=h.teams.list(m.mission_id)[0];observedStatus=t.status;h.calls.cancel.push(id);const w=m.workers.find(x=>x.id===id);if(w)w.status='cancelled';return true}})
  const t=await h.teams.create(h.m,'bounded investigation',['architect','repository-explorer'])
  t.expires_at=Date.now()-1
  await h.teams.expireMission(h.m)
  assert.equal(t.status,'shutdown')
  assert.equal(t.shutdown_reason,'expired')
  assert.equal(observedStatus,'shutdown','shutdown must be marked before abort/cancel callbacks can re-enter')
  assert.equal(h.calls.cancel.length,2)
  assert.equal(h.m.execution_mode,'single')
})

test('duplicate peer message key is idempotent and does not consume turn/message budget twice', async()=>{
  const h=harness();const t=await h.teams.create(h.m,'review',['architect','repository-explorer'])
  const a=h.teams.message(h.m,t.id,'parent','architect','inspect API','req-1')
  const b=h.teams.message(h.m,t.id,'parent','architect','inspect API','req-1')
  assert.equal(a.id,b.id)
  assert.equal(t.messages.length,1)
  assert.equal(t.turn_count,1)
})

test('team generation is bound to mission generation and stale team is shut down', async()=>{
  const h=harness();const t=await h.teams.create(h.m,'review',['architect','repository-explorer'])
  h.m.generation++
  await h.teams.expireMission(h.m,Date.now())
  assert.equal(t.status,'shutdown')
  assert.equal(t.shutdown_reason,'stale-generation')
  assert.equal(h.calls.cancel.length,2)
})

test('team degrades when fewer than two active peers remain without cancelling the surviving useful worker', async()=>{
  const h=harness();const t=await h.teams.create(h.m,'review',['architect','repository-explorer'])
  const first=h.m.workers.find(w=>w.id===t.worker_ids[0]), second=h.m.workers.find(w=>w.id===t.worker_ids[1])
  first.status='failed'
  await h.teams.reconcileMission(h.m)
  assert.equal(t.status,'shutdown')
  assert.equal(t.shutdown_reason,'insufficient-active-members')
  assert.equal(h.m.execution_mode,'single')
  assert.equal(second.status,'busy','surviving worker should continue as an ordinary bounded worker')
  assert.equal(h.calls.cancel.length,0)
})
