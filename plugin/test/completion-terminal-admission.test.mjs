import test from 'node:test'
import assert from 'node:assert/strict'

import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {evaluateCompletion} from '../dist/runtime/completion/evaluator.js'
import {projectControlDecision} from '../dist/runtime/completion/control-projection.js'
import {evaluateIdle} from '../dist/runtime/continuation/evaluator.js'

test('provisional mission cannot be admitted as complete before semantic assessment',()=>{
  const store=new MissionStore(),m=store.start('m08-semantic-pending','perform material work')
  const completion=evaluateCompletion(m)
  assert.equal(m.identity.semantic_assessment.status,'pending')
  assert.equal(completion.complete,false)
  assert.ok(completion.reasons.includes('semantic-assessment-pending'))
})

test('control projection cannot emit DONE while semantic assessment gate is pending',()=>{
  const store=new MissionStore(),m=store.start('m08-projection-pending','perform material work')
  const decision=projectControlDecision(m)
  assert.notEqual(decision.action,'DONE')
  assert.equal(decision.completion_ready,false)
})

test('sticky user STOP cannot be overwritten by a direct completion commit',()=>{
  const store=new MissionStore(),m=store.start('m08-sticky-stop','perform material work')
  store.stop(m.identity.session_id,'explicit-user-stop')
  const generation=m.continuation.generation
  store.complete(m.identity.session_id)
  assert.equal(m.identity.status,'stopped')
  assert.equal(m.continuation.user_interrupted,true)
  assert.equal(m.continuation.generation,generation)
  assert.equal(m.execution.ledger.filter(e=>e.type==='mission.completed').length,0)
})

test('successful terminal completion commit is idempotent',()=>{
  const store=new MissionStore(),m=store.start('m08-complete-once','perform material work')
  m.identity.semantic_assessment={status:'assessed',source:'model',assessed_at:Date.now()}
  store.complete(m.identity.session_id)
  const completedAt=m.identity.updated_at
  store.complete(m.identity.session_id)
  assert.equal(m.identity.status,'completed')
  assert.equal(m.execution.ledger.filter(e=>e.type==='mission.completed').length,1)
  assert.equal(m.identity.updated_at,completedAt)
})

const assessment=(message_kind='mission',continuation_required=false)=>({
  material:true,message_kind,task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',continuation_required,
  required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],user_verification:[],verification_ceiling:false,verification_cases:[],nonvisual_request_units:[],capability_request_units:{},likely_targets:[],mutation_targets:[],intent_signals:[],suppressed_intent_signals:[],constraint_atoms:[],
})

test('explicit later-user-turn continuation blocks completion and preserves exact Mission identity for the follow-up',()=>{
  const store=new MissionStore(),m=store.start('m08-user-followup','Do step one now and keep this same mission open for my next turn.')
  store.applyInitialSemanticAssessment(m.identity.session_id,assessment('mission',true))
  for(const obligation of m.execution.obligations){obligation.status='closed';obligation.closedAt=Date.now()}
  const before=m.identity.mission_id,completion=evaluateCompletion(m),idle=evaluateIdle(m)
  assert.equal(completion.complete,false)
  assert.ok(completion.reasons.includes('user-followup-required'))
  assert.equal(idle.decision,'WAIT')
  assert.equal(idle.reason_code,'waiting-user-continuation')
  store.beginFollowupSemanticAssessment(m.identity.session_id,'Continue the remaining step now.')
  assert.equal(m.identity.mission_id,before)
  assert.equal(m.continuation.awaiting_user_followup,false)
  store.applyFollowupSemanticAssessment(m.identity.session_id,assessment('amendment',false))
  assert.equal(m.identity.mission_id,before)
  assert.equal(m.continuation.awaiting_user_followup,false)
})


test('resume follow-up preserves continuation_required and blocks premature Mission completion',()=>{
  const store=new MissionStore(),m=store.start('m08-resume-continuation','Do step one, then keep this Mission open for the next user turn.')
  store.applyInitialSemanticAssessment(m.identity.session_id,assessment('mission',true))
  for(const obligation of m.execution.obligations){obligation.status='closed';obligation.closedAt=Date.now()}
  const missionID=m.identity.mission_id
  store.beginFollowupSemanticAssessment(m.identity.session_id,'Resume the interrupted step one and still keep the remaining step open.')
  store.applyFollowupSemanticAssessment(m.identity.session_id,assessment('resume',true))
  assert.equal(m.identity.mission_id,missionID)
  assert.equal(m.continuation.awaiting_user_followup,true)
  const completion=evaluateCompletion(m),idle=evaluateIdle(m)
  assert.equal(completion.complete,false)
  assert.ok(completion.reasons.includes('user-followup-required'))
  assert.equal(idle.decision,'WAIT')
  store.beginFollowupSemanticAssessment(m.identity.session_id,'Now complete the remaining step.')
  assert.equal(m.identity.mission_id,missionID)
})
