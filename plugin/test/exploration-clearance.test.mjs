import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'
import {explorationClearanceFreshness} from '../dist/runtime/execution/exploration-clearance.js'
import {opencodeChildPort} from './helpers/host-port.mjs'
import {addEvidence} from '../dist/runtime/evidence/evidence-runtime.js'
import {evidenceProducerAttemptForWorker} from '../dist/runtime/evidence/applicability.js'
import {captureEvidenceScopeState} from '../dist/runtime/evidence/scope-state.js'
import {createToolAfterHook} from '../dist/hooks/tool-after.js'

function root(){const r=mkdtempSync(join(tmpdir(),'hi-explore-clear-'));mkdirSync(join(r,'src'),{recursive:true});writeFileSync(join(r,'src','contract.ts'),'export interface Contract { id:string }\n');return r}
function mission(r,sid='s',ambiguity='resolvable'){
  const store=new MissionStore(r),m=store.start(sid,'resolve repository contract')
  store.applyInitialSemanticAssessment(sid,{material:true,message_kind:'mission',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity,dependency_class:'independent',required_capabilities:['implementation','repository-analysis'],requested_external_actions:[],likely_verification:[],likely_targets:['src/contract.ts'],intent_signals:[],suppressed_intent_signals:[]})
  return m
}
function runtime(r,client={}){return new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2})),r,r,()=>DEFAULT_HI_CONFIG,()=>[],()=>({agent:PACKAGED_HI_AGENTS}))}
function explorer(m){const analysis=m.execution.obligations.find(o=>o.kind==='analysis');assert.ok(analysis);const task=createTask(m,{objective:'resolve contract from repository evidence',role:'repository-explorer',category:'standard',scope:['src/contract.ts'],requiredEvidence:[],obligationIds:[analysis.id]}),worker=createWorker(m,task,'host-default');worker.status='busy';worker.session_id='explorer-session';worker.started_at=Date.now()-10;worker.native_diff_baseline={};worker.native_diff_final={};worker.native_state_hash='a'.repeat(64);worker.attempt=1;return{task,worker,analysis}}
function sourceClaimWithReceipt(r,m,task,worker){const state=captureEvidenceScopeState(r,['src/contract.ts']);assert.ok(state);const receipt=addEvidence(m,{kind:'source-read-observation',summary:'Explorer read src/contract.ts',scope:['src/contract.ts'],source:`explorer-read:${worker.id}`,trusted_source_class:'host-tool-observation',source_session_id:worker.session_id,source_state_hash:state,scope_state_hash:state,task_id:task.id,obligation_ids:task.obligation_ids,producer_attempt:evidenceProducerAttemptForWorker(m,worker),outcome:'pending',reason:'test read receipt'});return{kind:'source-provenance-evidence',summary:'current contract source inspected',scope:['src/contract.ts'],evidence_refs:[receipt.id],pass:true,outcome:'passed'}}
const decisionClaim=receiptID=>({kind:'decision-evidence',summary:'existing contract fixes the implementation choice',scope:['src/contract.ts'],evidence_refs:[receiptID],pass:true,outcome:'passed'})
function result(patch={}){return{status:'DONE',summary:'repository context mapped',changed_files:[],evidence:[],open_issues:[],needs_context:[],context_gap:'none',...patch}}

test('repository-explorer DONE without explicit bounded source clearance cannot erase resolvable ambiguity',()=>{
  const r=root();try{const m=mission(r),{task,worker,analysis}=explorer(m);runtime(r).applyResult(m,worker.id,result({context_gap:undefined}));assert.equal(task.result.status,'FIX_REQUIRED');assert.equal(m.identity.intent.ambiguity,'resolvable');assert.equal(analysis.status,'open');assert.ok(task.result.open_issues.some(x=>x.includes('exploration-clearance-unsatisfied')))}finally{rmSync(r,{recursive:true,force:true})}
})

test('resolvable ambiguity clears only from current bounded source provenance and creates runtime freshness evidence',()=>{
  const r=root();try{const m=mission(r),{task,worker,analysis}=explorer(m);runtime(r).applyResult(m,worker.id,result({evidence:[sourceClaimWithReceipt(r,m,task,worker)]}));assert.equal(task.result.status,'DONE');assert.equal(m.identity.intent.ambiguity,'none');assert.equal(analysis.status,'closed');const e=m.execution.evidence.items.find(x=>String(x.source??'').startsWith('exploration-clearance:resolvable:'));assert.ok(e);assert.equal(e.trusted_source_class,'runtime-observation');assert.equal(e.kind,'source-provenance-evidence');assert.match(e.scope_state_hash,/^[a-f0-9]{64}$/);assert.equal(explorationClearanceFreshness(r,m).current,true)}finally{rmSync(r,{recursive:true,force:true})}
})

test('downstream implementation issue notes do not veto otherwise complete repository exploration clearance',()=>{
  const r=root();try{
    const m=mission(r,'downstream-issue-note'),{task,worker,analysis}=explorer(m),source=sourceClaimWithReceipt(r,m,task,worker)
    runtime(r).applyResult(m,worker.id,result({
      summary:'Repository source is fully mapped; implementation remains writer-owned.',
      evidence:[source],
      open_issues:['normalizeName implementation remains for a write-capable worker','slug verification remains downstream']
    }))
    assert.equal(task.result.status,'DONE')
    assert.deepEqual(task.result.open_issues,['normalizeName implementation remains for a write-capable worker','slug verification remains downstream'])
    assert.equal(m.identity.intent.ambiguity,'none')
    assert.equal(analysis.status,'closed')
    assert.equal(explorationClearanceFreshness(r,m).current,true)
  }finally{rmSync(r,{recursive:true,force:true})}
})

test('structurally complete repository-explorer FIX_REQUIRED is normalized to DONE when only downstream writer work remains',()=>{
  const r=root();try{
    const m=mission(r,'fix-required-handoff'),{task,worker,analysis}=explorer(m),source=sourceClaimWithReceipt(r,m,task,worker)
    runtime(r).applyResult(m,worker.id,result({
      status:'FIX_REQUIRED',
      summary:'Repository analysis is complete; implementation belongs to a write-capable worker.',
      evidence:[source],
      open_issues:['bounded implementation remains writer-owned'],
      needs_context:[],
      context_gap:'none',
      failure_finding:'none'
    }))
    assert.equal(task.result.status,'DONE')
    assert.deepEqual(task.result.open_issues,['bounded implementation remains writer-owned'])
    assert.equal(m.identity.intent.ambiguity,'none')
    assert.equal(analysis.status,'closed')
    assert.equal(explorationClearanceFreshness(r,m).current,true)
    assert.ok(m.execution.ledger.some(e=>e.type==='exploration.result-normalized'&&e.payload?.from==='FIX_REQUIRED'&&e.payload?.to==='DONE'))
  }finally{rmSync(r,{recursive:true,force:true})}
})

test('repository-explorer FIX_REQUIRED remains fail-closed when bounded context is unresolved',()=>{
  const r=root();try{
    const m=mission(r,'fix-required-unresolved'),{task,worker,analysis}=explorer(m),source=sourceClaimWithReceipt(r,m,task,worker)
    runtime(r).applyResult(m,worker.id,result({status:'FIX_REQUIRED',evidence:[source],needs_context:['exact contract branch still unresolved'],context_gap:'iterative'}))
    assert.equal(task.result.status,'FIX_REQUIRED')
    assert.notEqual(m.identity.intent.ambiguity,'none')
    assert.equal(analysis.status,'open')
    assert.equal(explorationClearanceFreshness(r,m).required,false)
  }finally{rmSync(r,{recursive:true,force:true})}
})

test('contract-critical ambiguity requires a scoped decision claim in addition to current source provenance',()=>{
  const r=root();try{const m=mission(r,'critical-missing','contract-critical'),{task,worker}=explorer(m);runtime(r).applyResult(m,worker.id,result({evidence:[sourceClaimWithReceipt(r,m,task,worker)]}));assert.equal(task.result.status,'FIX_REQUIRED');assert.equal(m.identity.intent.ambiguity,'contract-critical');assert.ok(task.result.open_issues.some(x=>x.includes('decision-claim-missing')))}finally{rmSync(r,{recursive:true,force:true})}
})

test('contract-critical clearance accepts same-scope structured decision claim without promoting that claim to canonical decision evidence',()=>{
  const r=root();try{const m=mission(r,'critical-pass','contract-critical'),{task,worker}=explorer(m);const source=sourceClaimWithReceipt(r,m,task,worker);runtime(r).applyResult(m,worker.id,result({evidence:[source,decisionClaim(source.evidence_refs[0])]}));assert.equal(task.result.status,'DONE');assert.equal(m.identity.intent.ambiguity,'none');assert.equal(m.execution.evidence.items.some(x=>x.kind==='decision-evidence'),false);assert.ok(m.execution.evidence.items.some(x=>String(x.source??'').startsWith('exploration-clearance:contract-critical:')))}finally{rmSync(r,{recursive:true,force:true})}
})

test('contract-critical decision claim without the same canonical read receipt cannot clear ambiguity',()=>{
  const r=root();try{const m=mission(r,'critical-unbound','contract-critical'),{task,worker}=explorer(m),source=sourceClaimWithReceipt(r,m,task,worker);runtime(r).applyResult(m,worker.id,result({evidence:[source,{kind:'decision-evidence',summary:'unbound decision',scope:['src/contract.ts'],pass:true,outcome:'passed'}]}));assert.equal(task.result.status,'FIX_REQUIRED');assert.equal(m.identity.intent.ambiguity,'contract-critical');assert.ok(task.result.open_issues.some(x=>x.includes('decision-claim-scope-unbound')))}finally{rmSync(r,{recursive:true,force:true})}
})

test('source provenance outside explorer task scope cannot clear ambiguity',()=>{
  const r=root();try{mkdirSync(join(r,'other'),{recursive:true});writeFileSync(join(r,'other','x.ts'),'export const x=1\n');const m=mission(r,'outside'),{task,worker}=explorer(m);runtime(r).applyResult(m,worker.id,result({evidence:[{...sourceClaimWithReceipt(r,m,task,worker),scope:['other/x.ts']}]}));assert.equal(task.result.status,'FIX_REQUIRED');assert.equal(m.identity.intent.ambiguity,'resolvable');assert.ok(task.result.open_issues.some(x=>x.includes('source-provenance-outside-task-scope')))}finally{rmSync(r,{recursive:true,force:true})}
})

test('noncanonical read-shaped worker evidence remains inadmissible for exploration clearance',()=>{
  const r=root();try{const m=mission(r,'noncanonical-read-claim'),{task,worker}=explorer(m);runtime(r).applyResult(m,worker.id,result({evidence:[{kind:'read',summary:'read src/contract.ts',scope:['src/contract.ts'],pass:true,outcome:'passed'}]}));assert.equal(task.result.status,'FIX_REQUIRED');assert.ok(task.result.open_issues.some(x=>x.includes('source-provenance-claim-missing')));assert.equal(m.identity.intent.ambiguity,'resolvable')}finally{rmSync(r,{recursive:true,force:true})}
})

test('source claim without a same-attempt OpenCode read receipt cannot clear ambiguity',()=>{
  const r=root();try{const m=mission(r,'receipt-missing'),{task,worker}=explorer(m);runtime(r).applyResult(m,worker.id,result({evidence:[{kind:'source-provenance-evidence',summary:'claimed source',scope:['src/contract.ts'],pass:true,outcome:'passed'}]}));assert.equal(task.result.status,'FIX_REQUIRED');assert.ok(task.result.open_issues.some(x=>x.includes('source-read-receipt-missing')));assert.equal(m.identity.intent.ambiguity,'resolvable')}finally{rmSync(r,{recursive:true,force:true})}
})

test('OpenCode child read tool-after creates an exact repository-explorer source receipt',async()=>{
  const r=root();try{const store=new MissionStore(r),m=store.start('hook-read','resolve repository contract');store.applyInitialSemanticAssessment('hook-read',{material:true,message_kind:'mission',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'resolvable',dependency_class:'independent',required_capabilities:['implementation','repository-analysis'],requested_external_actions:[],likely_verification:[],likely_targets:['src/contract.ts'],intent_signals:[],suppressed_intent_signals:[]});const {task,worker}=explorer(m),background=new BackgroundRegistry();background.set(worker);const hook=createToolAfterHook(store,background,undefined,r,r),toolOutput={output:'export interface Contract { id:string }',title:'read',metadata:{}};await hook({sessionID:worker.session_id,tool:'read',args:{filePath:'src/contract.ts'}},toolOutput);const receipt=m.execution.evidence.items.find(e=>e.source===`explorer-read:${worker.id}`);assert.ok(receipt);assert.equal(receipt.kind,'source-read-observation');assert.equal(receipt.outcome,'pending');assert.equal(receipt.task_id,task.id);assert.equal(receipt.producer_attempt?.ordinal,worker.attempt);assert.deepEqual(receipt.scope,['src/contract.ts']);assert.match(receipt.scope_state_hash,/^[a-f0-9]{64}$/);assert.ok(m.execution.ledger.some(e=>e.type==='evidence.observed'&&e.payload?.kind==='source-read-observation'));assert.equal(m.execution.ledger.some(e=>e.type==='verification.pass'&&e.payload?.kind==='source-read-observation'),false);assert.match(toolOutput.output,new RegExp(`HI_SOURCE_READ_RECEIPT evidence_ref=${receipt.id} path=src/contract\.ts`))}finally{rmSync(r,{recursive:true,force:true})}
})

test('source drift after clearance blocks implementation and a fresh bounded explorer clearance reopens it',async()=>{
  const r=root();try{
    const m=mission(r,'drift'),{task,worker}=explorer(m),rt=runtime(r);rt.applyResult(m,worker.id,result({evidence:[sourceClaimWithReceipt(r,m,task,worker)]}));assert.equal(m.identity.intent.ambiguity,'none');assert.equal(explorationClearanceFreshness(r,m).current,true)
    writeFileSync(join(r,'src','contract.ts'),'export interface Contract { id:string; mode:string }\n');const stale=explorationClearanceFreshness(r,m);assert.equal(stale.required,true);assert.equal(stale.current,false);assert.equal(stale.reason,'source-state-drift')
    const blockedCreates=[],blockedClient={session:{create:async req=>{blockedCreates.push(req);return{data:{id:'blocked-coder'}}},promptAsync:async()=>({data:{}}),abort:async()=>({data:{}})}};await assert.rejects(()=>runtime(r,blockedClient).start(m,{role:'coder',objective:'implement contract',scope:['src/contract.ts']}),/Repository evidence that cleared prior ambiguity is stale/);assert.equal(blockedCreates.length,0)

    const refreshTask=createTask(m,{objective:'refresh contract evidence',role:'repository-explorer',category:'standard',scope:['src/contract.ts'],requiredEvidence:[],obligationIds:[]}),refreshWorker=createWorker(m,refreshTask,'host-default');refreshWorker.status='busy';refreshWorker.session_id='explorer-refresh';refreshWorker.started_at=Date.now()-10;refreshWorker.native_diff_baseline={};refreshWorker.native_diff_final={};refreshWorker.native_state_hash='b'.repeat(64);refreshWorker.attempt=1
    rt.applyResult(m,refreshWorker.id,result({evidence:[sourceClaimWithReceipt(r,m,refreshTask,refreshWorker)]}));assert.equal(refreshTask.result.status,'DONE');assert.equal(explorationClearanceFreshness(r,m).current,true)

    const creates=[],client={session:{create:async req=>{creates.push(req);return{data:{id:'coder-child'}}},promptAsync:async()=>({data:{}}),abort:async()=>({data:{}})}};const started=await runtime(r,client).start(m,{role:'coder',objective:'implement contract',scope:['src/contract.ts']});assert.ok(started.session_id);assert.equal(creates.length,1)
  }finally{rmSync(r,{recursive:true,force:true})}
})

test('stale exploration clearance does not deadlock exact same-session implementation correction',async()=>{
  const r=root();try{
    const m=mission(r,'corrective-stale'),{task:exploreTask,worker:exploreWorker}=explorer(m)
    const created=[],prompts=[],client={session:{create:async req=>{created.push(req);return{data:{id:`child-${created.length}`}}},promptAsync:async req=>{prompts.push(req);return{data:{}}},status:async()=>({data:{'child-1':{type:'idle'}}}),diff:async()=>({data:[]}),abort:async()=>({data:true})}}
    const rt=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2})),r,join(process.cwd(),'..'),()=>DEFAULT_HI_CONFIG,()=>[],()=>({agent:PACKAGED_HI_AGENTS}));rt.applyResult(m,exploreWorker.id,result({evidence:[sourceClaimWithReceipt(r,m,exploreTask,exploreWorker)]}));assert.equal(explorationClearanceFreshness(r,m).current,true)
    const implementation=m.execution.obligations.find(o=>o.kind==='implementation');assert.ok(implementation)
    const first=await rt.start(m,{role:'coder',objective:'implement current contract',scope:['src/contract.ts'],obligationIds:[implementation.id]});assert.equal(created.length,1)
    writeFileSync(join(r,'src','contract.ts'),'export interface Contract { id:string; mode:string }\n')
    rt.applyResult(m,first.worker_id,{status:'FIX_REQUIRED',summary:'one bounded correction remains',changed_files:['src/contract.ts'],evidence:[],open_issues:['fix:bounded-correction'],needs_context:[]})
    assert.equal(explorationClearanceFreshness(r,m).current,false)
    const beforeTasks=m.execution.tasks.length,beforeWorkers=m.execution.workers.length
    const resumed=await rt.resume(m,first.task_id)
    assert.equal(resumed.task_id,first.task_id);assert.equal(resumed.worker_id,first.worker_id);assert.equal(resumed.session_id,first.session_id)
    assert.equal(created.length,1,'corrective continuation must reuse the exact child session');assert.equal(m.execution.tasks.length,beforeTasks);assert.equal(m.execution.workers.length,beforeWorkers)
    assert.equal(m.execution.tasks.some(t=>t.role==='repository-explorer'&&t.id!==exploreTask.id),false,'resume must not manufacture a refresh worker')
    const correction=JSON.stringify(prompts.at(-1));assert.match(correction,/RECOVERY SOURCE REVALIDATION/);assert.match(correction,/inspect the current diff\/state and re-read the current bounded task scope/i);assert.match(correction,/src\/contract\.ts/);assert.match(correction,/do not widen mutation scope or restart planning/i)
    assert.ok(m.execution.ledger.some(e=>e.type==='task.resume.exploration-revalidation-owned'&&e.task_id===first.task_id&&e.worker_id===first.worker_id))
  }finally{rmSync(r,{recursive:true,force:true})}
})



test('rerun20-shaped unbound explorer scope normalizes to discovery and exact root-file receipts clear ambiguity',async()=>{
  const r=root();try{
    const store=new MissionStore(r),m=store.start('rerun20-scope','repair dashboard fixture with unresolved target')
    store.applyInitialSemanticAssessment('rerun20-scope',{material:true,message_kind:'mission',task_kind:'bug-fix',scope:'multi-file',risk:'medium',ambiguity:'resolvable',dependency_class:'independent',required_capabilities:['repository-analysis','implementation'],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]})
    const created=[],prompts=[],client={session:{create:async()=>({data:{id:`explorer-${created.push(1)}`}}),promptAsync:async req=>{prompts.push(req);return{data:{}}},diff:async()=>({data:[]}),abort:async()=>({data:true})}}
    const rt=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2})),r,join(process.cwd(),'..'),()=>DEFAULT_HI_CONFIG,()=>[],()=>({agent:PACKAGED_HI_AGENTS}))
    const analysis=m.execution.obligations.find(o=>o.kind==='analysis');assert.ok(analysis)
    const started=await rt.start(m,{objective:'map the unresolved dashboard source',role:'repository-explorer',scope:['workspace'],obligationIds:[analysis.id]})
    const task=m.execution.tasks.find(t=>t.id===started.task_id),worker=m.execution.workers.find(w=>w.id===started.worker_id);assert.ok(task&&worker)
    assert.deepEqual(task.scope,[],'unbound pseudo-scope cannot become canonical authority');assert.deepEqual(task.execution_profile.task.scope,[])
    assert.ok(m.execution.ledger.some(e=>e.type==='task.scope-unbound-discovery-normalized'&&e.payload?.unbound_scope?.includes('workspace')))
    rt.applyResult(m,worker.id,result({evidence:[sourceClaimWithReceipt(r,m,task,worker)]}))
    assert.equal(task.result.status,'DONE');assert.equal(m.identity.intent.ambiguity,'none');assert.deepEqual(m.identity.intent.likelyTargets,['src/contract.ts'])
    assert.equal(created.length,1);assert.equal(prompts.length,1)
  }finally{rmSync(r,{recursive:true,force:true})}
})




test('scenario05-shaped semantic slash target normalizes to empty explorer discovery and promotes observed source',async()=>{
  const r=root();try{
    const store=new MissionStore(r),m=store.start('semantic-slash-scope','repair the session/auth service')
    store.applyInitialSemanticAssessment('semantic-slash-scope',{material:true,message_kind:'mission',task_kind:'bug-fix',scope:'multi-file',risk:'high',ambiguity:'resolvable',dependency_class:'independent',required_capabilities:['repository-analysis','implementation'],requested_external_actions:[],likely_verification:[],likely_targets:['session/auth'],intent_signals:[],suppressed_intent_signals:[]})
    const created=[],client={session:{create:async()=>({data:{id:`explorer-${created.push(1)}`}}),promptAsync:async()=>({data:{}}),diff:async()=>({data:[]}),abort:async()=>({data:true})}}
    const rt=runtime(r,client),analysis=m.execution.obligations.find(o=>o.kind==='analysis');assert.ok(analysis)
    const started=await rt.start(m,{objective:'map the security-relevant repository source',role:'repository-explorer',obligationIds:[analysis.id]})
    const task=m.execution.tasks.find(t=>t.id===started.task_id),worker=m.execution.workers.find(w=>w.id===started.worker_id);assert.ok(task&&worker)
    assert.deepEqual(task.scope,[],'semantic slash target cannot become repository filesystem authority before discovery')
    assert.ok(m.execution.ledger.some(e=>e.type==='task.scope-unbound-discovery-normalized'&&e.payload?.unbound_scope?.includes('session/auth')))
    rt.applyResult(m,worker.id,result({evidence:[sourceClaimWithReceipt(r,m,task,worker)]}))
    assert.equal(task.result.status,'DONE');assert.equal(m.identity.intent.ambiguity,'none');assert.deepEqual(m.identity.intent.likelyTargets,['src/contract.ts'])
  }finally{rmSync(r,{recursive:true,force:true})}
})

test('runtime-bound explorer clearance promotes discovered source scope into canonical Mission targets',()=>{
  const r=root();try{
    const store=new MissionStore(r),m=store.start('target-promotion',"Fix dashboard fixture with unresolved source location")
    store.applyInitialSemanticAssessment('target-promotion',{material:true,message_kind:'mission',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'resolvable',dependency_class:'independent',required_capabilities:['implementation','repository-analysis'],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]})
    assert.equal(m.identity.intent.likelyTargets,undefined)
    const analysis=m.execution.obligations.find(o=>o.kind==='analysis');assert.ok(analysis)
    const task=createTask(m,{objective:'discover the exact source owning the bug',role:'repository-explorer',category:'standard',scope:[],requiredEvidence:[],obligationIds:[analysis.id]}),worker=createWorker(m,task,'host-default');worker.status='busy';worker.session_id='explorer-promotion';worker.started_at=Date.now()-10;worker.native_diff_baseline={};worker.native_diff_final={};worker.native_state_hash='c'.repeat(64);worker.attempt=1
    runtime(r).applyResult(m,worker.id,result({evidence:[sourceClaimWithReceipt(r,m,task,worker)]}))
    assert.equal(task.result.status,'DONE');assert.equal(m.identity.intent.ambiguity,'none');assert.deepEqual(m.identity.intent.likelyTargets,['src/contract.ts']);assert.equal(analysis.status,'closed');assert.ok(m.execution.ledger.some(e=>e.type==='intent.targets.resolved'&&e.payload?.source==='repository-explorer-clearance'&&e.payload?.targets?.includes('src/contract.ts')))
  }finally{rmSync(r,{recursive:true,force:true})}
})


test('repository-explorer structured review findings are ignored as unauthorized metadata without blocking valid exploration clearance',()=>{
  const r=root();try{
    const m=mission(r,'nonreviewer-findings'),{task,worker,analysis}=explorer(m),source=sourceClaimWithReceipt(r,m,task,worker)
    runtime(r).applyResult(m,worker.id,result({evidence:[source],findings:[{id:'rf-analysis-note',reviewer_role:'repository-explorer',subject:'pre-existing contract defect observed during analysis',severity:'medium',causality:'pre-existing',scope:['src/contract.ts'],evidence_refs:['source-provenance-evidence'],confidence:'high',disposition:'open',blocking:false}]}))
    assert.equal(task.result.status,'DONE')
    assert.equal(task.result.findings,undefined)
    assert.equal(m.identity.intent.ambiguity,'none')
    assert.equal(analysis.status,'closed')
    assert.ok(m.execution.ledger.some(e=>e.type==='review.finding-authority-ignored'&&e.worker_id===worker.id))
    assert.equal(m.execution.blockers.some(x=>x.includes('rf-analysis-note')),false)
  }finally{rmSync(r,{recursive:true,force:true})}
})
