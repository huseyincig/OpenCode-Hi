import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {openHumanDecision} from '../dist/runtime/human-decision/runtime.js'
import {collaborationView} from '../dist/runtime/collaboration/runtime.js'

function mission(id='collab'){
  const m=startAssessedMission(new MissionStore(process.cwd()),id,'coordinate bounded work',{task_kind:'analysis',required_capabilities:['analysis']})
  m.context.context_artifacts.push({id:'ca1',kind:'note',uri:'hi-artifact:ca1',sha256:'a'.repeat(64),added_at:1})
  m.execution.workers.push({id:'w1',task_id:'t1',role:'repository-explorer',category:'standard',session_id:'child-1',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f1',status:'busy',attempt:1,generation_at_spawn:m.continuation.generation,updated_at:2})
  return m
}

test('collaboration view projects canonical participants decision and context without owning them',()=>{
  const m=mission();const d=openHumanDecision(m,{semantic_type:'preference',reason_code:'pick-shape',summary:'Pick shape',response_schema:{kind:'choice',choices:['a','b']}})
  const view=collaborationView(m)
  assert.equal(view.claim_boundary,'projection-only');assert.equal(view.authority,'canonical-owners-only')
  assert.deepEqual(view.participants.map(x=>x.kind),['primary-session','child-worker'])
  assert.equal(view.participants[1].session_id,'child-1');assert.equal(view.open_human_decision?.decision_id,d.decision_id)
  assert.deepEqual(view.context_artifacts,[{id:'ca1',kind:'note',uri:'hi-artifact:ca1',sha256:'a'.repeat(64)}])
  assert.equal('approve' in view,false);assert.equal('complete' in view,false);assert.equal('persist' in view,false)
})

test('collaboration view keeps peer coordination derived and does not manufacture remote participants',()=>{
  const m=mission('current'),peer=mission('peer');peer.execution.workers=[]
  const view=collaborationView(m,[peer])
  assert.ok(view.coordination.peer_units>=0);assert.equal(view.participants.some(x=>x.mission_id===peer.identity.mission_id),false,'peer missions are coordination surfaces, not fabricated participants')
  assert.equal(view.open_human_decision,undefined)
})
