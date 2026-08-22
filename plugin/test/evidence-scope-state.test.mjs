import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {addEvidence} from '../dist/runtime/evidence/evidence-runtime.js'
import {captureEvidenceScopeState} from '../dist/runtime/evidence/scope-state.js'
import {evidenceProducerAttemptForWorker} from '../dist/runtime/evidence/applicability.js'
import {reviewObligationSatisfied,verificationSatisfied} from '../dist/runtime/verification/policy.js'
import {evaluateCompletion} from '../dist/runtime/completion/evaluator.js'
import {isEvidenceItemContract} from '../dist/contracts/evidence.js'
import {syncMissionGates} from '../dist/runtime/gates/gates.js'
import {evaluatePreconditions} from '../dist/runtime/readiness/preconditions.js'
import {buildMissionRuntimeProjection} from '../dist/runtime/context/mission-runtime-projection.js'
import {createHiToolSurface} from '../dist/runtime/application/hi-tool-surface.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {detectOpenCodeCapabilities} from '../dist/opencode/capabilities.js'
import {evaluateIdle} from '../dist/runtime/continuation/evaluator.js'

function reviewedMission(root){
  const store=new MissionStore(root),m=store.start('scope-state-review','independently review src/auth.ts')
  store.applyInitialSemanticAssessment(m.identity.session_id,{material:true,message_kind:'mission',task_kind:'review',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['review','independent-review'],requested_external_actions:[],likely_verification:['review-evidence'],user_verification:[],verification_ceiling:false,likely_targets:['src/auth.ts'],intent_signals:[],suppressed_intent_signals:[]})
  const review=m.execution.obligations.find(o=>o.kind==='review'),verification=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(review);assert.ok(verification);verification.requiredEvidence=['review-evidence'];m.execution.verification_policy={requiredKinds:['review-evidence'],requireFresh:true,requireReview:true,allowWorkerReportedEvidence:false}
  const task=createTask(m,{objective:'independently review src/auth.ts',role:'qa-reviewer',category:'standard',scope:['src/auth.ts'],constraints:[],dependencies:[],requiredEvidence:['review-evidence'],obligationIds:[review.id,verification.id]}),worker=createWorker(m,task,'host-default',[],[],[])
  worker.session_id='review-child';worker.status='completed';worker.attempt=1;worker.generation_at_spawn=m.continuation.generation;worker.native_state_hash='a'.repeat(64);task.status='completed';task.result={status:'DONE',summary:'review passed',changed_files:[],evidence:[],open_issues:[],needs_context:[]}
  const scopeStateHash=captureEvidenceScopeState(root,['src/auth.ts']);assert.match(scopeStateHash,/^[a-f0-9]{64}$/)
  addEvidence(m,{kind:'review-evidence',summary:'independent review passed',scope:['src/auth.ts'],source:`reviewer:${worker.id}`,trusted_source_class:'reviewer-observation',source_session_id:worker.session_id,source_state_hash:worker.native_state_hash,scope_state_hash:scopeStateHash,task_id:task.id,obligation_ids:[review.id,verification.id],producer_attempt:evidenceProducerAttemptForWorker(m,worker),pass:true,outcome:'passed'})
  review.status='closed';review.closedAt=Date.now();verification.status='closed';verification.closedAt=Date.now()
  return{store,m,review,verification}
}

test('canonical review freshness follows exact current scoped bytes even when mutation bypasses Hi events',()=>{
  const root=mkdtempSync(join(process.env.TMPDIR??tmpdir(),'hi-scope-state-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true});writeFileSync(join(root,'src','auth.ts'),'export const allow=false\n')
    const {m,review,verification}=reviewedMission(root)
    assert.equal(reviewObligationSatisfied(m,review.id,root).ok,true)
    assert.equal(verificationSatisfied(m,verification.id,root).ok,true)
    assert.equal(evaluateCompletion(m,root).complete,true)
    writeFileSync(join(root,'src','auth.ts'),'export const allow=true\n')
    assert.equal(reviewObligationSatisfied(m,review.id,root).ok,false)
    assert.equal(verificationSatisfied(m,verification.id,root).ok,false)
    const completion=evaluateCompletion(m,root);assert.equal(completion.complete,false);assert.ok(['VERIFY','RECONCILE'].includes(completion.next))
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('evidence scope-state contract accepts only canonical SHA-256 identity',()=>{
  const base={id:'ev-scope',kind:'review-evidence',summary:'reviewed',scope:['src/auth.ts'],source:'reviewer:w',trusted_source_class:'reviewer-observation',source_session_id:'s',source_state_hash:'b'.repeat(64),task_id:'t',obligation_ids:['o-review'],observed_at:1,pass:true,outcome:'passed'}
  assert.equal(isEvidenceItemContract({...base,scope_state_hash:'c'.repeat(64)}),true)
  assert.equal(isEvidenceItemContract({...base,scope_state_hash:'not-a-state'}),false)
})


test('scope-bound review freshness is coherent across completion gates readiness and runtime projection',()=>{
  const root=mkdtempSync(join(process.env.TMPDIR??tmpdir(),'hi-scope-state-projection-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true});writeFileSync(join(root,'src','auth.ts'),'export const allow=false\n')
    const {m}=reviewedMission(root)
    assert.equal(evaluateCompletion(m,root).complete,true)
    assert.deepEqual(syncMissionGates(m,root).filter(g=>['gate-verification','gate-reviewer'].includes(g.id)).map(g=>[g.id,g.status]),[['gate-verification','closed'],['gate-reviewer','closed']])
    writeFileSync(join(root,'src','auth.ts'),'export const allow=true\n')
    const completion=evaluateCompletion(m,root);assert.equal(completion.complete,false);assert.equal(completion.next,'VERIFY')
    const gates=syncMissionGates(m,root);assert.equal(gates.find(g=>g.id==='gate-verification')?.status,'open');assert.equal(gates.find(g=>g.id==='gate-reviewer')?.status,'open')
    const readiness=evaluatePreconditions(m,root);assert.equal(readiness.items.find(g=>g.id==='gate-verification')?.status,'waiting');assert.equal(readiness.items.find(g=>g.id==='gate-reviewer')?.status,'waiting')
    const projection=buildMissionRuntimeProjection(m,undefined,root);assert.match(projection.next_action,/^verify:review-evidence/);assert.ok(projection.blockers.some(x=>x.includes('gate:gate-verification:open')));assert.ok(projection.blockers.some(x=>x.includes('gate:gate-reviewer:open')));assert.match(projection.verification,/evidence=stale/)
    const idle=evaluateIdle(m,Date.now()+1000,root);assert.equal(idle.decision,'VERIFY');assert.equal(idle.reason_code,'verification-pending');assert.equal(m.execution.gates.find(g=>g.id==='gate-verification')?.status,'open');assert.equal(m.execution.gates.find(g=>g.id==='gate-reviewer')?.status,'open');assert.match(idle.prompt??'',/current evidence is stale or missing/)
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('hi_readiness projects external review-scope staleness without spawning or rereviewing',async()=>{
  const root=mkdtempSync(join(process.env.TMPDIR??tmpdir(),'hi-scope-state-readiness-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true});writeFileSync(join(root,'src','auth.ts'),'export const allow=false\n')
    const {store}=reviewedMission(root)
    const state={config:structuredClone(DEFAULT_HI_CONFIG),hostConfig:{},openCodeVersion:'1.18.20'}
    const {toolSurface}=createHiToolSurface({state,store,tasks:{},processRuntime:{},projectRoot:root,capabilities:detectOpenCodeCapabilities({}),native:{},getModels:()=>[],scopedStores:{contextArtifacts:{}}})
    writeFileSync(join(root,'src','auth.ts'),'export const allow=true\n')
    const readiness=JSON.parse(await toolSurface.hi_readiness.execute({},{sessionID:'scope-state-review'}))
    assert.equal(readiness.items.find(g=>g.id==='gate-verification')?.status,'waiting')
    assert.equal(readiness.items.find(g=>g.id==='gate-reviewer')?.status,'waiting')
  }finally{rmSync(root,{recursive:true,force:true})}
})
