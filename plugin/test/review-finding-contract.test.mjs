import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {isReviewFindingContract} from '../dist/contracts/review-finding.js'
import {normalizeWorkerResult} from '../dist/contracts/worker-result.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {verificationSatisfied} from '../dist/runtime/verification/policy.js'
import {opencodeChildPort} from './helpers/host-port.mjs'

function runtime(root=process.cwd()){return new TaskRuntime(opencodeChildPort({}),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),root,root,()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))}
function reviewMission(id,root=process.cwd()){const store=new MissionStore(root);const m=store.start(id,'review src/a.ts');store.applyInitialSemanticAssessment(id,{material:true,message_kind:'mission',task_kind:'review',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['review','independent-review'],requested_external_actions:[],likely_verification:['review-evidence'],likely_targets:['src/a.ts'],intent_signals:[],suppressed_intent_signals:[]});m.execution.verification_policy={requiredKinds:['review-evidence'],requireFresh:true,requireReview:true,allowWorkerReportedEvidence:true};return m}
function reviewerTask(m,role='qa-reviewer'){const review=m.execution.obligations.find(o=>o.kind==='review'),verification=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(review);assert.ok(verification);verification.requiredEvidence=['review-evidence'];const task=createTask(m,{objective:'review src/a.ts',role,category:'standard',scope:['src/a.ts'],requiredEvidence:['review-evidence'],obligationIds:[review.id,verification.id]});const worker=createWorker(m,task,'host-default');worker.status='busy';worker.started_at=Date.now()-5;worker.session_id='review-session';worker.native_state_hash='c'.repeat(64);return{task,worker,review,verification}}
const proof={kind:'review-evidence',summary:'reviewed src/a.ts',scope:['src/a.ts'],pass:true,outcome:'passed'}
function finding(overrides={}){return{id:'rf-null-guard',reviewer_role:'qa-reviewer',subject:'Null guard can be bypassed on the changed path',severity:'high',causality:'introduced',scope:['src/a.ts'],evidence_refs:['review-evidence'],confidence:'high',disposition:'open',blocking:true,...overrides}}

test('ReviewFinding requires technical identity, closed enums and evidence for blocking semantics',()=>{
  assert.equal(isReviewFindingContract(finding()),true)
  assert.equal(isReviewFindingContract(finding({id:'bad id'})),false)
  assert.equal(isReviewFindingContract(finding({severity:'urgent'})),false)
  assert.equal(isReviewFindingContract(finding({evidence_refs:[]})),false)
})

test('introduced open reviewer finding forces FIX_REQUIRED even if reviewer claimed DONE',()=>{
  const m=reviewMission('rf-actionable'),{task,worker,review}=reviewerTask(m)
  const result=normalizeWorkerResult({status:'DONE',summary:'review completed with finding',changed_files:[],evidence:[proof],findings:[finding()],open_issues:[],needs_context:[]})
  runtime().applyResult(m,worker.id,result)
  assert.equal(task.status,'waiting')
  assert.equal(task.result?.status,'FIX_REQUIRED')
  assert.equal(review.status,'open')
  assert.ok(m.execution.blockers.some(x=>x.startsWith('review-finding:rf-null-guard:high:introduced')))
})

test('pre-existing finding is preserved without becoming an unrelated mission blocker',()=>{
  const root=mkdtempSync(join(process.env.TMPDIR??tmpdir(),'hi-review-finding-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true});writeFileSync(join(root,'src','a.ts'),'export const a=1\n')
    const m=reviewMission('rf-preexisting',root),{task,worker,review,verification}=reviewerTask(m)
    const result=normalizeWorkerResult({status:'DONE',summary:'review completed; existing debt recorded',changed_files:[],evidence:[proof],findings:[finding({id:'rf-existing-debt',causality:'pre-existing',blocking:false})],open_issues:[],needs_context:[]})
    runtime(root).applyResult(m,worker.id,result)
    assert.equal(task.status,'completed')
    assert.equal(review.status,'closed')
    assert.equal(verification.status,'closed')
    assert.equal(verificationSatisfied(m,verification.id,root).ok,true)
    assert.ok(task.result?.findings?.some(x=>x.id==='rf-existing-debt'))
    assert.equal(m.execution.blockers.some(x=>x.includes('rf-existing-debt')),false)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('finding reviewer identity must match the actual canonical reviewer worker',()=>{
  const m=reviewMission('rf-role'),{task,worker}=reviewerTask(m)
  const result=normalizeWorkerResult({status:'DONE',summary:'review',changed_files:[],evidence:[proof],findings:[finding({id:'rf-role-spoof',reviewer_role:'security-reviewer'})],open_issues:[],needs_context:[]})
  runtime().applyResult(m,worker.id,result)
  assert.equal(task.result?.status,'FIX_REQUIRED')
  assert.ok(task.result?.open_issues.some(x=>x.startsWith('review-finding-role-mismatch:rf-role-spoof')))
})

test('blocking finding with unknown causality requires reconciliation instead of gaining blocker authority',()=>{
  const m=reviewMission('rf-unknown-causality'),{task,worker}=reviewerTask(m)
  const result=normalizeWorkerResult({status:'DONE',summary:'review',changed_files:[],evidence:[proof],findings:[finding({id:'rf-unknown-owner',causality:'unknown'})],open_issues:[],needs_context:[]})
  runtime().applyResult(m,worker.id,result)
  assert.equal(task.result?.status,'FIX_REQUIRED')
  assert.ok(task.result?.open_issues.includes('review-finding-causality-unresolved:rf-unknown-owner'))
  assert.ok(task.result?.needs_context.some(x=>x.startsWith('review-finding-causality-reconcile:')))
})

test('finding evidence refs must resolve to evidence kinds returned by the same WorkerResult',()=>{
  const result=normalizeWorkerResult({status:'DONE',summary:'review',changed_files:[],evidence:[proof],findings:[finding({id:'rf-bad-ref',evidence_refs:['build']})],open_issues:[],needs_context:[]})
  assert.equal(result.findings,undefined,'normalizer must not retain a blocking finding whose proof reference is absent')
})
