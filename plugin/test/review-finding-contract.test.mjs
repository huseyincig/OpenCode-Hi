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

test('introduced open reviewer finding forces FIX_REQUIRED and opens evidence-backed writer rework',()=>{
  const root=mkdtempSync(join(process.env.TMPDIR??tmpdir(),'hi-review-finding-actionable-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true});writeFileSync(join(root,'src','a.ts'),'export const a=1\n')
    const m=reviewMission('rf-actionable',root),{task,worker,review}=reviewerTask(m)
    const result=normalizeWorkerResult({status:'DONE',summary:'review completed with finding',changed_files:[],evidence:[proof],findings:[finding()],open_issues:[],needs_context:[]})
    runtime(root).applyResult(m,worker.id,result)
    assert.equal(task.status,'waiting')
    assert.equal(task.result?.status,'FIX_REQUIRED')
    assert.equal(review.status,'open')
    assert.ok(m.execution.blockers.some(x=>x.startsWith('review-finding:rf-null-guard:high:introduced')))
    const rework=m.execution.obligations.find(o=>o.id==='o-review-rework-rf-null-guard');assert.ok(rework);assert.equal(rework.kind,'implementation');assert.equal(rework.status,'open');assert.deepEqual(rework.requiredTargets,['src/a.ts'])
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('introduced non-blocking informational findings remain review notes without writer rework or failed verdict',()=>{
  const root=mkdtempSync(join(process.env.TMPDIR??tmpdir(),'hi-review-finding-info-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true});writeFileSync(join(root,'src','a.ts'),'export const a=1\n')
    const m=reviewMission('rf-info-note',root),{task,worker,review,verification}=reviewerTask(m)
    const result=normalizeWorkerResult({status:'FIX_REQUIRED',summary:'review passed with informational notes',changed_files:[],evidence:[proof],findings:[finding({id:'rf-info-note',severity:'info',blocking:false,subject:'Optional edge case is not specified by the contract'})],open_issues:[],needs_context:[]})
    runtime(root).applyResult(m,worker.id,result)
    assert.equal(task.status,'completed')
    assert.equal(task.result?.status,'DONE')
    assert.equal(review.status,'closed')
    assert.equal(verification.status,'closed')
    assert.equal(m.execution.blockers.some(x=>x.includes('rf-info-note')),false)
    assert.equal(m.execution.obligations.some(o=>o.id==='o-review-rework-rf-info-note'),false)
    assert.ok(task.result?.findings?.some(x=>x.id==='rf-info-note'&&x.blocking===false))
    assert.ok(m.execution.ledger.some(e=>e.type==='review.nonblocking-result-normalized'&&e.task_id===task.id))
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('introduced open non-blocking finding is preserved without forcing writer rework',()=>{
  const root=mkdtempSync(join(process.env.TMPDIR??tmpdir(),'hi-review-finding-nonblocking-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true});writeFileSync(join(root,'src','a.ts'),'export const a=1\n')
    const m=reviewMission('rf-nonblocking-done',root),{task,worker,review,verification}=reviewerTask(m)
    const note=finding({id:'rf-info-note',severity:'info',blocking:false})
    const result=normalizeWorkerResult({status:'DONE',summary:'review passed with a non-blocking observation',changed_files:[],evidence:[proof],findings:[note],open_issues:[],needs_context:[]})
    runtime(root).applyResult(m,worker.id,result)
    assert.equal(task.status,'completed')
    assert.equal(task.result?.status,'DONE')
    assert.equal(review.status,'closed')
    assert.equal(verification.status,'closed')
    assert.ok(task.result?.findings?.some(x=>x.id==='rf-info-note'&&x.blocking===false))
    assert.equal(m.execution.blockers.some(x=>x.includes('rf-info-note')),false)
    assert.equal(m.execution.obligations.some(o=>o.id==='o-review-rework-rf-info-note'),false)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('contradictory FIX_REQUIRED with only non-blocking findings and passing review verdict normalizes to DONE',()=>{
  const root=mkdtempSync(join(process.env.TMPDIR??tmpdir(),'hi-review-finding-nonblocking-fix-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true});writeFileSync(join(root,'src','a.ts'),'export const a=1\n')
    const m=reviewMission('rf-nonblocking-fix',root),{task,worker,review,verification}=reviewerTask(m)
    const a=finding({id:'rf-info-one',severity:'info',blocking:false}),b=finding({id:'rf-low-two',severity:'low',blocking:false,subject:'Optional coverage hardening'})
    const result=normalizeWorkerResult({status:'FIX_REQUIRED',summary:'review passed; only advisory findings remain',changed_files:[],evidence:[proof],findings:[a,b],open_issues:[`review-finding:${a.id}:${a.severity}:${a.causality}`,`review-finding:${b.id}:${b.severity}:${b.causality}`],needs_context:[]})
    runtime(root).applyResult(m,worker.id,result)
    assert.equal(task.status,'completed')
    assert.equal(task.result?.status,'DONE')
    assert.deepEqual(task.result?.open_issues,[])
    assert.equal(review.status,'closed')
    assert.equal(verification.status,'closed')
    assert.equal(m.execution.obligations.some(o=>o.id.startsWith('o-review-rework-rf-info-')||o.id==='o-review-rework-rf-low-two'),false)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('FIX_REQUIRED with non-blocking finding plus unrelated unresolved issue remains fail-closed',()=>{
  const root=mkdtempSync(join(process.env.TMPDIR??tmpdir(),'hi-review-finding-nonblocking-unresolved-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true});writeFileSync(join(root,'src','a.ts'),'export const a=1\n')
    const m=reviewMission('rf-nonblocking-unresolved',root),{task,worker}=reviewerTask(m)
    const note=finding({id:'rf-info-unresolved',severity:'info',blocking:false})
    const result=normalizeWorkerResult({status:'FIX_REQUIRED',summary:'review has an unresolved control issue',changed_files:[],evidence:[proof],findings:[note],open_issues:[`review-finding:${note.id}:${note.severity}:${note.causality}`,'unrelated-review-control-gap'],needs_context:[]})
    runtime(root).applyResult(m,worker.id,result)
    assert.equal(task.status,'waiting')
    assert.equal(task.result?.status,'FIX_REQUIRED')
    assert.ok(task.result?.open_issues.includes('unrelated-review-control-gap'))
    assert.equal(m.execution.obligations.some(o=>o.id==='o-review-rework-rf-info-unresolved'),false)
  }finally{rmSync(root,{recursive:true,force:true})}
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
    assert.equal(m.execution.obligations.some(o=>o.id==='o-review-rework-rf-existing-debt'),false)
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
  assert.equal(m.execution.obligations.some(o=>o.id==='o-review-rework-rf-unknown-owner'),false)
})

test('explicit malformed finding fails closed instead of silently disappearing during compatibility normalization',()=>{
  const result=normalizeWorkerResult({status:'DONE',summary:'review',changed_files:[],evidence:[proof],findings:[finding({id:'rf-bad-ref',evidence_refs:['build']})],open_issues:[],needs_context:[]})
  assert.equal(result.findings,undefined,'normalizer must not grant authority to a finding whose proof reference is absent')
  assert.equal(result.status,'FIX_REQUIRED')
  assert.ok(result.open_issues.includes('review-finding-contract-invalid'))
  assert.ok(result.needs_context.some(x=>x.startsWith('review-finding-contract-retry:')))
})


test('plain FIX_REQUIRED or prose open_issue cannot acquire writer rework authority',()=>{
  const m=reviewMission('rf-prose-only'),{task,worker}=reviewerTask(m)
  const result=normalizeWorkerResult({status:'FIX_REQUIRED',summary:'Filter appears wrong',changed_files:[],evidence:[],open_issues:['Filter handler appears not to update the count'],needs_context:[]})
  runtime().applyResult(m,worker.id,result)
  assert.equal(task.result?.status,'FIX_REQUIRED')
  assert.equal(m.execution.obligations.some(o=>o.id.startsWith('o-review-rework-')),false)
})
