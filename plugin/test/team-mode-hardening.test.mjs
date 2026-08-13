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
  const limits={maxMembers:4,maxWallMs:1000}
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
  assert.equal(observedStatus,'shutdown')
  assert.equal(h.calls.cancel.length,2)
  assert.equal(h.m.execution_mode,'single')
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
  assert.equal(second.status,'busy')
  assert.equal(h.calls.cancel.length,0)
})

test('team shutdown is mission-owned and rejects cross-mission access',async()=>{
  const h=harness();const t=await h.teams.create(h.m,'review',['architect','repository-explorer'])
  const other=new MissionStore().start('other-session','other mission')
  await assert.rejects(()=>h.teams.shutdown(other,t.id),/different mission/)
  assert.equal(t.status,'active')
})

test('team mode rejects unknown roles instead of diverging team identity from normalized worker role',async()=>{
  const h=harness()
  await assert.rejects(()=>h.teams.create(h.m,'review',['architect','not-a-role']),/Unknown Team Mode role/)
  const t=await h.teams.create(h.m,'review',['architect','repository-explorer'])
  await assert.rejects(()=>h.teams.addMember(h.m,t.id,'not-a-role'),/Unknown Team Mode role/)
})

test('read-only team members receive the current changed surface instead of an empty review scope',async()=>{
  const h=harness();h.m.changed_files=['src/a.ts','src/b.ts']
  await h.teams.create(h.m,'review',['architect','qa-reviewer'])
  assert.deepEqual(h.calls.start[0].input.scope,['src/a.ts','src/b.ts'])
  assert.deepEqual(h.calls.start[1].input.scope,['src/a.ts','src/b.ts'])
})
