import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { RuntimePersistence } from '../dist/runtime/state/persistence.js'
import { createTask, createWorker } from '../dist/runtime/worker/worker-runtime.js'
import { evidenceProducerAttemptForWorker } from '../dist/runtime/evidence/applicability.js'
import { reviewObligationSatisfied } from '../dist/runtime/verification/policy.js'

function highRiskMission(sessionID='review-parent'){
  const store=new MissionStore()
  const m=store.start(sessionID,'change authorization boundary')
  store.applyInitialSemanticAssessment(sessionID,{
    material:true,
    message_kind:'mission',
    task_kind:'implementation',
    scope:'local',
    risk:'high',
    ambiguity:'none',
    dependency_class:'independent',
    required_capabilities:['implementation','independent-review'],
    requested_external_actions:[],
    likely_verification:['targeted-tests'],
    likely_targets:['src/auth.ts'],
    intent_signals:[],
    suppressed_intent_signals:[],
  })
  const review=m.execution.obligations.find(o=>o.kind==='review')
  assert.ok(review)
  assert.equal(m.execution.verification_policy.requireReview,true)
  return{m,review}
}

function roundTrip(m){
  const root=mkdtempSync(join(tmpdir(),'hi-review-provenance-'))
  try{
    const persistence=new RuntimePersistence(root)
    persistence.save([m],true)
    const loaded=persistence.load()
    assert.equal(persistence.lastLoadReport.error,undefined)
    assert.equal(loaded.length,1)
    return loaded[0]
  }finally{
    rmSync(root,{recursive:true,force:true})
  }
}

function addReviewerEvidence(m,review,overrides={}){
  m.execution.evidence.items.push({
    id:`review-${m.execution.evidence.items.length+1}`,
    kind:'review-evidence',
    summary:'independent review passed',
    scope:['src/auth.ts'],
    source:'reviewer:legacy',
    trusted_source_class:'reviewer-observation',
    obligation_ids:[review.id],
    observed_at:Date.now(),
    pass:true,
    outcome:'passed',
    ...overrides,
  })
}

test('persisted reviewer-observation without exact producer identity cannot satisfy high-risk review',()=>{
  const {m,review}=highRiskMission('unbound-review-parent')
  addReviewerEvidence(m,review)
  const restored=roundTrip(m)
  assert.deepEqual(reviewObligationSatisfied(restored,review.id),{
    ok:false,
    reason:'fresh-claim-linked-review-evidence-required',
  })
})

test('persisted coder-bound evidence cannot impersonate an independent reviewer',()=>{
  const {m,review}=highRiskMission('coder-review-parent')
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation')
  assert.ok(implementation)
  const task=createTask(m,{objective:'implement authorization change',role:'coder',category:'standard',scope:['src/auth.ts'],constraints:[],dependencies:[],requiredEvidence:['targeted-tests'],obligationIds:[implementation.id]})
  const worker=createWorker(m,task,'host-default',[],[],[])
  worker.session_id='coder-child';worker.status='completed';worker.attempt=1;worker.native_state_hash='c'.repeat(64)
  addReviewerEvidence(m,review,{
    source:`reviewer:${worker.id}`,
    source_session_id:worker.session_id,
    source_state_hash:worker.native_state_hash,
    task_id:task.id,
    producer_attempt:evidenceProducerAttemptForWorker(m,worker),
  })
  const restored=roundTrip(m)
  assert.equal(reviewObligationSatisfied(restored,review.id).ok,false)
})

test('persisted reviewer-observation with a wrong source-state hash cannot satisfy high-risk review',()=>{
  const {m,review}=highRiskMission('wrong-state-review-parent')
  const task=createTask(m,{objective:'independently review authorization change',role:'qa-reviewer',category:'standard',scope:['src/auth.ts'],constraints:[],dependencies:[],requiredEvidence:['review-evidence'],obligationIds:[review.id]})
  const worker=createWorker(m,task,'host-default',[],[],[])
  worker.session_id='review-child';worker.status='completed';worker.attempt=1;worker.native_state_hash='a'.repeat(64)
  addReviewerEvidence(m,review,{
    source:`reviewer:${worker.id}`,
    source_session_id:worker.session_id,
    source_state_hash:'b'.repeat(64),
    task_id:task.id,
    producer_attempt:evidenceProducerAttemptForWorker(m,worker),
  })
  const restored=roundTrip(m)
  assert.equal(reviewObligationSatisfied(restored,review.id).ok,false)
})

test('exact persisted reviewer role/session/state/attempt evidence remains admissible',()=>{
  const {m,review}=highRiskMission('exact-review-parent')
  const task=createTask(m,{objective:'independently review authorization change',role:'qa-reviewer',category:'standard',scope:['src/auth.ts'],constraints:[],dependencies:[],requiredEvidence:['review-evidence'],obligationIds:[review.id]})
  const worker=createWorker(m,task,'host-default',[],[],[])
  worker.session_id='review-child';worker.status='completed';worker.attempt=1;worker.native_state_hash='a'.repeat(64)
  addReviewerEvidence(m,review,{
    source:`reviewer:${worker.id}`,
    source_session_id:worker.session_id,
    source_state_hash:worker.native_state_hash,
    task_id:task.id,
    producer_attempt:evidenceProducerAttemptForWorker(m,worker),
  })
  const restored=roundTrip(m)
  assert.equal(reviewObligationSatisfied(restored,review.id).ok,true)
})
