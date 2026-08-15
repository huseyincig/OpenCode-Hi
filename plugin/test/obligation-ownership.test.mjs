import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { ConcurrencyScheduler } from '../dist/runtime/scheduler/concurrency.js'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { createTask, createWorker } from '../dist/runtime/worker/worker-runtime.js'
import { addEvidence } from '../dist/runtime/evidence/evidence-runtime.js'
import { verificationSatisfied } from '../dist/runtime/verification/policy.js'
import { DEFAULT_HI_CONFIG } from '../dist/config/defaults.js'
import { methodologyExitCheck } from '../dist/runtime/methodology/exit.js'

function runtime(){
  return new TaskRuntime({},new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
}
function assessedMission(id,objective,overrides={}){
  const store=new MissionStore(); const m=store.start(id,objective)
  store.applyInitialSemanticAssessment(id,{material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:[],suppressed_intent_signals:[],...overrides})
  return m
}

const done={status:'DONE',summary:'done',changed_files:[],evidence:[],open_issues:[],needs_context:[]}

test('coder DONE cannot close an implementation obligation it does not own',()=>{
  const m=assessedMission('ownership-1','change alpha')
  const base=m.execution.obligations.find(o=>o.kind==='implementation')
  assert.ok(base)
  m.execution.obligations.push({id:'o-followup-owned',kind:'implementation',summary:'User follow-up: change beta',status:'open',requiredEvidence:[]})
  const unrelated=createTask(m,{objective:'change gamma',role:'coder',category:'standard',requiredEvidence:[],obligationIds:[]})
  const wu=createWorker(m,unrelated,'host-default'); wu.status='busy'; wu.started_at=Date.now()-5
  runtime().applyResult(m,wu.id,done)
  assert.equal(base.status,'open')
  assert.equal(m.execution.obligations.find(o=>o.id==='o-followup-owned').status,'open')

  const owned=createTask(m,{objective:'change beta',role:'coder',category:'standard',requiredEvidence:[],obligationIds:['o-followup-owned']})
  const wo=createWorker(m,owned,'host-default'); wo.status='busy'; wo.started_at=Date.now()-5
  runtime().applyResult(m,wo.id,done)
  assert.equal(m.execution.obligations.find(o=>o.id==='o-followup-owned').status,'closed')
  assert.equal(base.status,'open','task-owned completion must not consume the other open implementation obligation')
})

test('worker evidence is scoped to its owned verification obligation',()=>{
  const m=assessedMission('ownership-2','fix bug and test it',{task_kind:'bug-fix',likely_verification:['targeted-tests']})
  m.execution.verification_policy={requiredKinds:['targeted-tests'],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:true}
  const v1=m.execution.obligations.find(o=>o.kind==='verification'); assert.ok(v1)
  v1.requiredEvidence=['targeted-tests']
  m.execution.obligations.push({id:'o-verification-followup',kind:'verification',summary:'verify separate beta surface',status:'open',requiredEvidence:['targeted-tests']})
  addEvidence(m,{kind:'targeted-tests',summary:'alpha tests pass',scope:['src/alpha.ts'],source:'worker:w1',source_session_id:'s-worker',source_state_hash:'b'.repeat(64),task_id:'t1',obligation_ids:[v1.id],pass:true,outcome:'passed'})
  assert.deepEqual(verificationSatisfied(m,v1.id),{ok:true,missing:[]})
  assert.deepEqual(verificationSatisfied(m,'o-verification-followup'),{ok:false,missing:['targeted-tests']})
})


test('reviewer DONE prose without explicit source-bound review evidence cannot close review or verification',()=>{
  const m=assessedMission('ownership-review','Perform an independent review of src/a.ts',{task_kind:'review',required_capabilities:['review','independent-review'],likely_verification:['review-evidence'],likely_targets:['src/a.ts']})
  m.execution.verification_policy={requiredKinds:['review-evidence'],requireFresh:true,requireReview:true,allowWorkerReportedEvidence:true}
  const review=m.execution.obligations.find(o=>o.kind==='review'); const verification=m.execution.obligations.find(o=>o.kind==='verification'); assert.ok(review); assert.ok(verification)
  verification.requiredEvidence=['review-evidence']
  const task=createTask(m,{objective:'independently review src/a.ts',role:'qa-reviewer',category:'standard',requiredEvidence:['review-evidence'],obligationIds:[review.id,verification.id]})
  const worker=createWorker(m,task,'host-default'); worker.status='busy'; worker.started_at=Date.now()-5;worker.session_id='review-session'
  runtime().applyResult(m,worker.id,{status:'DONE',summary:'review complete; safe to release',changed_files:[],evidence:[],open_issues:[],needs_context:[]})
  assert.deepEqual(verificationSatisfied(m,verification.id),{ok:false,missing:['review-evidence','review-obligation']})
  assert.equal(review.status,'open'); assert.equal(verification.status,'open')
  assert.equal(m.execution.evidence.items.some(e=>e.kind==='review-evidence'),false,'DONE prose must not synthesize PASS Evidence')
  assert.ok(m.execution.ledger.some(e=>e.type==='review.claim-unproven'))
})

test('reviewer explicit PASS without source-state identity remains inadmissible',()=>{
  const m=assessedMission('ownership-review-no-state','Review src/a.ts',{task_kind:'review',required_capabilities:['review','independent-review'],likely_verification:['review-evidence'],likely_targets:['src/a.ts']})
  m.execution.verification_policy={requiredKinds:['review-evidence'],requireFresh:true,requireReview:true,allowWorkerReportedEvidence:true}
  const review=m.execution.obligations.find(o=>o.kind==='review'),verification=m.execution.obligations.find(o=>o.kind==='verification');verification.requiredEvidence=['review-evidence']
  const task=createTask(m,{objective:'review src/a.ts',role:'qa-reviewer',category:'standard',requiredEvidence:['review-evidence'],obligationIds:[review.id,verification.id]})
  const worker=createWorker(m,task,'host-default');worker.status='busy';worker.started_at=Date.now()-5;worker.session_id='review-session'
  runtime().applyResult(m,worker.id,{status:'DONE',summary:'review complete',changed_files:[],evidence:[{kind:'review-evidence',summary:'reviewed target',scope:['src/a.ts'],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(review.status,'open');assert.equal(verification.status,'open');assert.deepEqual(verificationSatisfied(m,verification.id),{ok:false,missing:['review-evidence','review-obligation']})
})

test('source-bound explicit reviewer evidence can close its owned review and verification obligations',()=>{
  const m=assessedMission('ownership-review-proof','Review src/a.ts',{task_kind:'review',required_capabilities:['review','independent-review'],likely_verification:['review-evidence'],likely_targets:['src/a.ts']})
  m.execution.verification_policy={requiredKinds:['review-evidence'],requireFresh:true,requireReview:true,allowWorkerReportedEvidence:true}
  const review=m.execution.obligations.find(o=>o.kind==='review'),verification=m.execution.obligations.find(o=>o.kind==='verification');verification.requiredEvidence=['review-evidence']
  const task=createTask(m,{objective:'review src/a.ts',role:'qa-reviewer',category:'standard',requiredEvidence:['review-evidence'],obligationIds:[review.id,verification.id]})
  const worker=createWorker(m,task,'host-default');worker.status='busy';worker.started_at=Date.now()-5;worker.session_id='review-session';worker.native_state_hash='a'.repeat(64)
  runtime().applyResult(m,worker.id,{status:'DONE',summary:'bounded review complete',changed_files:[],evidence:[{kind:'review-evidence',summary:'reviewed target',scope:['src/a.ts'],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(review.status,'closed');assert.equal(verification.status,'closed');assert.deepEqual(verificationSatisfied(m,verification.id),{ok:true,missing:[]})
})


test('review evidence cannot satisfy a different verification obligation',()=>{
  const m=assessedMission('ownership-review-obligation','review two bounded surfaces',{task_kind:'review',required_capabilities:['review'],likely_verification:['review-evidence']})
  m.execution.verification_policy={requiredKinds:['review-evidence'],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:true}
  const first=m.execution.obligations.find(o=>o.kind==='verification'); assert.ok(first); first.requiredEvidence=['review-evidence']
  m.execution.obligations.push({id:'o-review-verification-beta',kind:'verification',summary:'review beta',status:'open',requiredEvidence:['review-evidence']})
  addEvidence(m,{kind:'review-evidence',summary:'alpha reviewed',scope:['src/alpha.ts'],source:'parent:direct-review',obligation_ids:[first.id],pass:true,outcome:'passed'})
  assert.deepEqual(verificationSatisfied(m,first.id),{ok:true,missing:[]})
  assert.deepEqual(verificationSatisfied(m,'o-review-verification-beta'),{ok:false,missing:['review-evidence']})
})


test('methodology review exit rejects unrelated mission review proof and accepts related surface proof',()=>{
  const store=new MissionStore(); const m=store.start('ownership-methodology-review','review src/a.ts')
  const task=createTask(m,{objective:'review src/a.ts',role:'qa-reviewer',category:'standard',scope:['src/a.ts'],requiredEvidence:[],obligationIds:[]})
  task.status='completed';task.result={status:'DONE',summary:'review task done',changed_files:[],evidence:[],open_issues:[],needs_context:[]}
  addEvidence(m,{kind:'review-evidence',summary:'unrelated review',scope:['src/b.ts'],source:'parent:direct-review',pass:true,outcome:'passed'})
  assert.equal(methodologyExitCheck(m,'hi-code-review',{task,result:task.result,projectRoot:process.cwd()}).ok,false)
  addEvidence(m,{kind:'review-evidence',summary:'independent review of target surface',scope:['src/a.ts'],source:'parent:direct-review',pass:true,outcome:'passed'})
  assert.equal(methodologyExitCheck(m,'hi-code-review',{task,result:task.result,projectRoot:process.cwd()}).ok,true)
})
