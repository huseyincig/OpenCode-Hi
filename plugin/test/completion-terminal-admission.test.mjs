import test from 'node:test'
import assert from 'node:assert/strict'

import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {evaluateCompletion} from '../dist/runtime/completion/evaluator.js'
import {projectControlDecision} from '../dist/runtime/completion/control-projection.js'

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
