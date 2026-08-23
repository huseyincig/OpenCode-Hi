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

test('source claim without a same-attempt OpenCode read receipt cannot clear ambiguity',()=>{
  const r=root();try{const m=mission(r,'receipt-missing'),{task,worker}=explorer(m);runtime(r).applyResult(m,worker.id,result({evidence:[{kind:'source-provenance-evidence',summary:'claimed source',scope:['src/contract.ts'],pass:true,outcome:'passed'}]}));assert.equal(task.result.status,'FIX_REQUIRED');assert.ok(task.result.open_issues.some(x=>x.includes('source-read-receipt-missing')));assert.equal(m.identity.intent.ambiguity,'resolvable')}finally{rmSync(r,{recursive:true,force:true})}
})

test('OpenCode child read tool-after creates an exact repository-explorer source receipt',async()=>{
  const r=root();try{const store=new MissionStore(r),m=store.start('hook-read','resolve repository contract');store.applyInitialSemanticAssessment('hook-read',{material:true,message_kind:'mission',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'resolvable',dependency_class:'independent',required_capabilities:['implementation','repository-analysis'],requested_external_actions:[],likely_verification:[],likely_targets:['src/contract.ts'],intent_signals:[],suppressed_intent_signals:[]});const {task,worker}=explorer(m),background=new BackgroundRegistry();background.set(worker);const hook=createToolAfterHook(store,background,undefined,r,r);await hook({sessionID:worker.session_id,tool:'read',args:{filePath:'src/contract.ts'}},{output:'export interface Contract { id:string }'});const receipt=m.execution.evidence.items.find(e=>e.source===`explorer-read:${worker.id}`);assert.ok(receipt);assert.equal(receipt.kind,'source-read-observation');assert.equal(receipt.outcome,'pending');assert.equal(receipt.task_id,task.id);assert.equal(receipt.producer_attempt?.ordinal,worker.attempt);assert.deepEqual(receipt.scope,['src/contract.ts']);assert.match(receipt.scope_state_hash,/^[a-f0-9]{64}$/);assert.ok(m.execution.ledger.some(e=>e.type==='evidence.observed'&&e.payload?.kind==='source-read-observation'));assert.equal(m.execution.ledger.some(e=>e.type==='verification.pass'&&e.payload?.kind==='source-read-observation'),false)}finally{rmSync(r,{recursive:true,force:true})}
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
