import test from 'node:test'
import assert from 'node:assert/strict'
import {isEvidenceItemContract} from '../dist/contracts/evidence.js'
import {normalizeWorkerResult} from '../dist/contracts/worker-result.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {addEvidence} from '../dist/runtime/evidence/evidence-runtime.js'
import {verificationSatisfied,reviewObligationSatisfied} from '../dist/runtime/verification/policy.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {evidenceProducerAttemptForWorker} from '../dist/runtime/evidence/applicability.js'
import {startAssessedMission} from './helpers/semantic.mjs'

const canonical={id:'ev-verdict',kind:'targeted-tests',summary:'focused verifier result',scope:['src/a.ts'],source:'bash',observed_at:1}

test('EvidenceItem rejects contradictory pass/outcome verdicts',()=>{
  assert.equal(isEvidenceItemContract({...canonical,pass:true,outcome:'failed'}),false)
  assert.equal(isEvidenceItemContract({...canonical,pass:false,outcome:'passed'}),false)
  assert.equal(isEvidenceItemContract({...canonical,pass:true,outcome:'pending'}),false)
  assert.equal(isEvidenceItemContract({...canonical,pass:false,outcome:'environment-issue'}),false)
  assert.equal(isEvidenceItemContract({...canonical,pass:true,outcome:'passed'}),true)
  assert.equal(isEvidenceItemContract({...canonical,pass:false,outcome:'failed'}),true)
})

test('WorkerResult normalization gives explicit outcome one canonical verdict and cannot preserve a contradiction',()=>{
  const result=normalizeWorkerResult({status:'DONE',summary:'worker claim',changed_files:[],evidence:[
    {kind:'targeted-tests',summary:'contradictory failure',pass:true,outcome:'failed'},
    {kind:'lint',summary:'contradictory pass',pass:false,outcome:'passed'},
    {kind:'build',summary:'environment unavailable',pass:true,outcome:'environment-issue'},
  ],open_issues:[],needs_context:[]})
  assert.deepEqual(result.evidence.map(e=>[e.kind,e.outcome,e.pass]),[
    ['targeted-tests','failed',false],
    ['lint','passed',true],
    ['build','environment-issue',undefined],
  ])
})

test('canonical addEvidence fails closed instead of storing contradictory proof',()=>{
  const m=new MissionStore().start('verdict-add','verify')
  assert.throws(()=>addEvidence(m,{kind:'targeted-tests',summary:'contradiction',scope:['src/a.ts'],source:'bash',pass:true,outcome:'failed'}),/contradict|verdict/i)
  assert.equal(m.execution.evidence.items.length,0)
})

test('contradictory legacy/in-memory verification evidence cannot become PASS authority',()=>{
  const m=startAssessedMission(new MissionStore(),'verdict-legacy-verify','fix src/a.ts',{task_kind:'bug-fix',likely_verification:['targeted-tests'],likely_targets:['src/a.ts']})
  const verification=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(verification)
  m.execution.evidence.items.push({...canonical,id:'ev-invalid-legacy',obligation_ids:[verification.id],pass:true,outcome:'failed'})
  assert.deepEqual(verificationSatisfied(m,verification.id),{ok:false,missing:['targeted-tests']})
})

test('contradictory exact reviewer evidence cannot close an independent review claim',()=>{
  const m=startAssessedMission(new MissionStore(),'verdict-review','review src/auth.ts',{task_kind:'review',risk:'high',required_capabilities:['review','independent-review'],likely_verification:['review-evidence'],likely_targets:['src/auth.ts']})
  const review=m.execution.obligations.find(o=>o.kind==='review');assert.ok(review)
  const task=createTask(m,{objective:'independently review auth',role:'qa-reviewer',category:'standard',scope:['src/auth.ts'],requiredEvidence:['review-evidence'],obligationIds:[review.id]})
  const worker=createWorker(m,task,'host-default');worker.session_id='review-verdict-child';worker.native_state_hash='a'.repeat(64);worker.attempt=1;worker.generation_at_spawn=m.continuation.generation;worker.status='completed';task.status='completed'
  m.execution.evidence.items.push({id:'ev-invalid-review',kind:'review-evidence',summary:'contradictory reviewer verdict',scope:['src/auth.ts'],source:`reviewer:${worker.id}`,trusted_source_class:'reviewer-observation',source_session_id:worker.session_id,source_state_hash:worker.native_state_hash,task_id:task.id,obligation_ids:[review.id],producer_attempt:evidenceProducerAttemptForWorker(m,worker),observed_at:Date.now(),pass:true,outcome:'failed'})
  assert.equal(reviewObligationSatisfied(m,review.id).ok,false)
})
