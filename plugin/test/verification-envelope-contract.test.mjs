import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { addEvidence } from '../dist/runtime/evidence/evidence-runtime.js'
import { verificationEnvelopeFor,verificationSatisfied } from '../dist/runtime/verification/policy.js'
import { isVerificationEnvelopeContract } from '../dist/contracts/verification-envelope.js'
import { compactLedgerReport } from '../dist/runtime/ledger/report.js'
import { startAssessedMission } from './helpers/semantic.mjs'

function mission(id='verification-envelope'){
  const store=new MissionStore(process.cwd())
  const m=startAssessedMission(store,id,'verify src/a.ts',{task_kind:'bug-fix',likely_verification:['targeted-tests'],likely_targets:['src/a.ts']})
  m.execution.evidence.last_mutation_at=Date.now()-100
  return m
}

test('VerificationEnvelope derives a passed check only from explicit passed evidence',()=>{
  const m=mission('ve-passed')
  addEvidence(m,{kind:'targeted-tests',summary:'focused tests',scope:['src/a.ts'],source:'bash',pass:true,outcome:'passed'})
  const env=verificationEnvelopeFor(m)
  assert.equal(isVerificationEnvelopeContract(env),true)
  assert.equal(env.checks.length,1)
  assert.equal(env.checks[0].result,'passed')
  assert.equal(env.checks[0].evidence_refs.length,1)
  assert.deepEqual(env.scope,['src/a.ts'])
  assert.deepEqual(verificationSatisfied(m),{ok:true,missing:[]})
})

test('outcome-less evidence is pending and cannot silently satisfy verification',()=>{
  const m=mission('ve-implicit')
  addEvidence(m,{kind:'targeted-tests',summary:'claim without explicit outcome',scope:['src/a.ts'],source:'test-fixture'})
  // Freshness is intentionally forced here so this test isolates explicit outcome authority.
  m.execution.evidence.fresh=true
  const env=verificationEnvelopeFor(m)
  assert.equal(env.checks[0].result,'pending')
  assert.match(env.checks[0].explanation,/no explicit verification outcome/i)
  assert.deepEqual(verificationSatisfied(m),{ok:false,missing:['targeted-tests']})
})

test('missing required check is not_run with explanation and never a pass',()=>{
  const m=mission('ve-not-run')
  m.execution.evidence.fresh=true
  const env=verificationEnvelopeFor(m)
  assert.equal(env.checks[0].result,'not_run')
  assert.match(env.checks[0].explanation,/No admissible evidence/i)
  assert.equal(env.checks[0].evidence_refs.length,0)
  assert.deepEqual(verificationSatisfied(m),{ok:false,missing:['targeted-tests']})
})

test('failed and environment-issue remain distinct verification results',()=>{
  const failed=mission('ve-failed')
  addEvidence(failed,{kind:'targeted-tests',summary:'tests failed',scope:['src/a.ts'],source:'bash',pass:false,outcome:'failed',reason:'exit-1'})
  failed.execution.evidence.fresh=true
  assert.equal(verificationEnvelopeFor(failed).checks[0].result,'failed')
  const unavailable=mission('ve-env')
  addEvidence(unavailable,{kind:'targeted-tests',summary:'runner unavailable',scope:['src/a.ts'],source:'bash',outcome:'environment-issue',reason:'tool-missing'})
  unavailable.execution.evidence.fresh=true
  assert.equal(verificationEnvelopeFor(unavailable).checks[0].result,'environment-issue')
})

test('obligation-scoped worker evidence cannot satisfy a different verification obligation',()=>{
  const m=mission('ve-scope')
  const first=m.execution.obligations.find(o=>o.kind==='verification'); assert.ok(first)
  first.requiredEvidence=['targeted-tests']
  m.execution.obligations.push({id:'o-other-verification',kind:'verification',summary:'other verification',status:'open',requiredEvidence:['targeted-tests']})
  addEvidence(m,{kind:'targeted-tests',summary:'first only',scope:['src/a.ts'],source:'worker:w1',task_id:'t1',obligation_ids:[first.id],pass:true,outcome:'passed'})
  assert.equal(verificationEnvelopeFor(m,first.id).checks[0].result,'passed')
  assert.equal(verificationEnvelopeFor(m,'o-other-verification').checks[0].result,'not_run')
})

test('required independent review is represented in envelope and report rather than inferred separately',()=>{
  const store=new MissionStore(process.cwd())
  const m=startAssessedMission(store,'ve-review','review src/a.ts',{task_kind:'review',risk:'high',required_capabilities:['review','independent-review'],likely_verification:['review-evidence'],likely_targets:['src/a.ts']})
  m.execution.evidence.fresh=true
  const env=verificationEnvelopeFor(m)
  assert.equal(env.independent_review,false)
  assert.ok(env.limitations.includes('independent-review-required'))
  assert.ok(verificationSatisfied(m).missing.includes('review-obligation'))
  const report=compactLedgerReport(m)
  assert.deepEqual(report.verification,env)
})

test('VerificationEnvelope validator rejects a passed check with no evidence reference',()=>{
  assert.equal(isVerificationEnvelopeContract({checks:[{kind:'targeted-tests',subject:'x',result:'passed',evidence_refs:[]}],scope:[],freshness:'fresh',limitations:[],independent_review:true}),false)
  assert.equal(isVerificationEnvelopeContract({checks:[{kind:'targeted-tests',subject:'x',result:'not_run',evidence_refs:[]}],scope:[],freshness:'fresh',limitations:[],independent_review:true}),false)
})
