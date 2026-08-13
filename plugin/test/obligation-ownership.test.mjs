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

function runtime(){
  return new TaskRuntime({},new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
}

const done={status:'DONE',summary:'done',changed_files:[],evidence:[],open_issues:[],needs_context:[]}

test('coder DONE cannot close an implementation obligation it does not own',()=>{
  const s=new MissionStore(); const m=s.start('ownership-1','change alpha')
  const base=m.obligations.find(o=>o.kind==='implementation')
  assert.ok(base)
  m.obligations.push({id:'o-followup-owned',kind:'implementation',summary:'User follow-up: change beta',status:'open',requiredEvidence:[]})
  const unrelated=createTask(m,{objective:'change gamma',role:'coder',category:'standard',requiredEvidence:[],obligationIds:[]})
  const wu=createWorker(m,unrelated,'host-default'); wu.status='busy'; wu.started_at=Date.now()-5
  runtime().applyResult(m,wu.id,done)
  assert.equal(base.status,'open')
  assert.equal(m.obligations.find(o=>o.id==='o-followup-owned').status,'open')

  const owned=createTask(m,{objective:'change beta',role:'coder',category:'standard',requiredEvidence:[],obligationIds:['o-followup-owned']})
  const wo=createWorker(m,owned,'host-default'); wo.status='busy'; wo.started_at=Date.now()-5
  runtime().applyResult(m,wo.id,done)
  assert.equal(m.obligations.find(o=>o.id==='o-followup-owned').status,'closed')
  assert.equal(base.status,'open','task-owned completion must not consume the other open implementation obligation')
})

test('worker evidence is scoped to its owned verification obligation',()=>{
  const s=new MissionStore(); const m=s.start('ownership-2','fix bug and test it')
  m.verification_policy={requiredKinds:['targeted-tests'],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:true}
  const v1=m.obligations.find(o=>o.kind==='verification'); assert.ok(v1)
  v1.requiredEvidence=['targeted-tests']
  m.obligations.push({id:'o-verification-followup',kind:'verification',summary:'verify separate beta surface',status:'open',requiredEvidence:['targeted-tests']})
  addEvidence(m,{kind:'targeted-tests',summary:'alpha tests pass',scope:['src/alpha.ts'],source:'worker:w1',task_id:'t1',obligation_ids:[v1.id],pass:true,outcome:'passed'})
  assert.deepEqual(verificationSatisfied(m,v1.id),{ok:true,missing:[]})
  assert.deepEqual(verificationSatisfied(m,'o-verification-followup'),{ok:false,missing:['targeted-tests']})
})


test('owned reviewer DONE synthesizes canonical review evidence for its verification obligation',()=>{
  const store=new MissionStore(); const m=store.start('ownership-review','Perform an independent review of src/a.ts')
  m.verification_policy={requiredKinds:['review-evidence'],requireFresh:true,requireReview:true,allowWorkerReportedEvidence:true}
  const review=m.obligations.find(o=>o.kind==='review'); const verification=m.obligations.find(o=>o.kind==='verification'); assert.ok(review); assert.ok(verification)
  verification.requiredEvidence=['review-evidence']
  const task=createTask(m,{objective:'independently review src/a.ts',role:'qa-reviewer',category:'standard',requiredEvidence:['review-evidence'],obligationIds:[review.id,verification.id]})
  const worker=createWorker(m,task,'host-default'); worker.status='busy'; worker.started_at=Date.now()-5
  runtime().applyResult(m,worker.id,{status:'DONE',summary:'reviewed src/a.ts with no findings',changed_files:[],evidence:[],open_issues:[],needs_context:[]})
  assert.deepEqual(verificationSatisfied(m,verification.id),{ok:true,missing:[]})
  assert.equal(review.status,'closed'); assert.equal(verification.status,'closed')
})
