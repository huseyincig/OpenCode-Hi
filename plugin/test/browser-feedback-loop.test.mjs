import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import path from 'node:path'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'
import {createHiToolSurface} from '../dist/runtime/application/hi-tool-surface.js'
import {browserObservationId} from '../dist/contracts/browser-observation.js'
import {evidenceClaimApplicability} from '../dist/runtime/evidence/applicability.js'
import {activateMethodologySignal} from '../dist/runtime/methodology/activation.js'
import {projectControlDecision} from '../dist/runtime/completion/control-projection.js'
import {opencodeChildPort} from './helpers/host-port.mjs'

function client(created=[],prompts=[]){let n=0;return{session:{
  create:async req=>{const id=`m13-feedback-child-${++n}`;created.push({id,req});return{data:{id}}},
  promptAsync:async req=>{prompts.push(req);return{data:{}}},
  abort:async()=>({data:true}),diff:async()=>({data:[]}),
}}}
function observation(taskID){const x={task_id:taskID,executor_version:'hi-playwright-browser@1',url:'http://127.0.0.1:4173/',action:'inspect',timestamp:Date.now(),document_identity:createHash('sha256').update(`feedback:${taskID}`).digest('hex'),dom_summary:'Submit button overlaps error text',console_errors:[],network_errors:[],result:'OBSERVED'};return{...x,observation_id:browserObservationId(x)}}

const repoRoot=path.resolve(process.cwd(),'..')
const EXISTING_READ_SCOPE='plugin/src/runtime/task/task-runtime.ts'

test('browser finding transfers source remediation to a writer before fresh visual re-verification',async()=>{
  const created=[],prompts=[],c=client(created,prompts),host={agent:PACKAGED_HI_AGENTS}
  const browser={health:async()=>({available:true}),inspect:async cx=>observation(cx.task_id),cleanup:async()=>({cleaned:true,reason:'closed'})}
  const registry=new BackgroundRegistry(),scheduler=createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}}))
  const runtime=new TaskRuntime(opencodeChildPort(c),registry,scheduler,repoRoot,repoRoot,()=>resolveHiConfig({},repoRoot),()=>[{id:'provider/vision',provider:'provider',visionCapable:true,writeCapable:true}],()=>host,undefined,[],undefined,undefined,()=>new Set(['host-capability:browser-execution']),browser)
  const store=new MissionStore(repoRoot),m=store.start('m13-feedback','verify the local UI and report regressions')
  store.applyInitialSemanticAssessment('m13-feedback',{material:true,message_kind:'mission',task_kind:'review',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['review','visual-qa'],requested_external_actions:[],likely_verification:['browser-evidence'],likely_targets:['src/ui.tsx'],intent_signals:['intent.browser'],suppressed_intent_signals:[]})
  activateMethodologySignal(m,repoRoot,{signal:'intent.browser',producer:'intent',reason:'task requires real browser interaction'})
  const first=await runtime.start(m,{objective:'verify local UI',role:'visual-qa',category:'visual',scope:['src/ui.tsx'],requiredEvidence:['browser-evidence'],browserBackend:'bounded-playwright',browserAllowedOrigins:['http://127.0.0.1:4173']})
  assert.equal(created.length,1);assert.equal(prompts.length,1);assert.equal(first.readiness,'READY')
  const task=m.execution.tasks.find(t=>t.id===first.task_id),worker=m.execution.workers.find(w=>w.id===first.worker_id)
  assert.ok(task);assert.ok(worker);assert.ok(worker.selected_methodologies.includes('hi-browser-testing'));worker.loaded_methodologies=[...worker.selected_methodologies]
  const surface=createHiToolSurface({state:{config:resolveHiConfig({}),hostConfig:host,openCodeVersion:'1.18.18'},store,tasks:runtime,processRuntime:{},browserExecutor:browser,projectRoot:repoRoot,capabilities:{contracts:[]},native:{},getModels:()=>[{id:'provider/vision',provider:'provider',visionCapable:true,writeCapable:true}],scopedStores:{contextArtifacts:{}}}).toolSurface
  const inspected=JSON.parse(await surface.hi_browser_inspect.execute({task_id:task.id},{sessionID:worker.session_id}))
  const observationEvidence=m.execution.evidence.items.find(e=>e.id===inspected.evidence_ref);assert.ok(observationEvidence);assert.equal(evidenceClaimApplicability(m,observationEvidence).applicable,true)
  runtime.applyResult(m,worker.id,{status:'DONE',summary:'Visual regression found',changed_files:[],evidence:[{kind:'browser-evidence',summary:'overlap reproduced in real browser',scope:['src/ui.tsx'],evidence_refs:[inspected.evidence_ref],pass:true,outcome:'passed'}],findings:[{id:'rf-browser-overlap',reviewer_role:'visual-qa',subject:'Submit button overlaps error text',severity:'high',causality:'introduced',scope:['src/ui.tsx'],evidence_refs:['browser-evidence'],confidence:'high',disposition:'open',blocking:true}],open_issues:[],needs_context:[]})
  assert.equal(task.result?.status,'FIX_REQUIRED');assert.equal(task.status,'waiting');assert.equal(worker.status,'ready');assert.ok(task.result.open_issues.some(x=>x.startsWith('review-finding:rf-browser-overlap:high:introduced')))
  const rework=m.execution.obligations.find(o=>o.id==='o-review-rework-rf-browser-overlap');assert.ok(rework);assert.equal(rework.kind,'implementation');assert.equal(rework.status,'open');assert.deepEqual(rework.requiredTargets,['src/ui.tsx'])
  assert.equal(projectControlDecision(m,repoRoot).action,'CONTINUE','writer-owned rework must take control before verifier correction')
  await assert.rejects(runtime.resume(m,task.id),/cannot resume before canonical predecessor rework closes/)

  const coderStarted=await runtime.start(m,{objective:'resolve rf-browser-overlap',role:'coder',category:'standard',scope:['src/ui.tsx'],obligationIds:[rework.id]})
  const coderTask=m.execution.tasks.find(t=>t.id===coderStarted.task_id),coderWorker=m.execution.workers.find(w=>w.id===coderStarted.worker_id);assert.ok(coderTask);assert.ok(coderWorker);assert.equal(coderTask.role,'coder');assert.ok(coderTask.obligation_ids.includes(rework.id))
  runtime.applyResult(m,coderWorker.id,{status:'DONE',summary:'Resolved overlap',changed_files:['src/ui.tsx'],evidence:[],open_issues:[],needs_context:[]})
  assert.equal(rework.status,'closed');assert.equal(projectControlDecision(m,repoRoot).action,'RECONCILE','closed remediation must return control to the prior verifier result')

  const taskCount=m.execution.tasks.length,workerCount=m.execution.workers.length,firstAttempt=worker.attempt,sessionID=worker.session_id
  const second=await runtime.resume(m,task.id)
  assert.equal(second.task_id,task.id);assert.equal(second.worker_id,worker.id);assert.equal(second.session_id,sessionID);assert.equal(m.execution.tasks.length,taskCount);assert.equal(m.execution.workers.length,workerCount);assert.equal(worker.attempt,firstAttempt+1)
  assert.equal(evidenceClaimApplicability(m,observationEvidence).applicable,false,'prior browser observation must not prove the fresh verification attempt')
  assert.match(JSON.stringify(prompts.at(-1)),/Hi corrective resume for existing task/);assert.match(JSON.stringify(prompts.at(-1)),/review-finding:rf-browser-overlap/)
})


test('read-only worker self-reported changed_files is ignored when native diff proves zero mutation',async()=>{
  const created=[],prompts=[],c=client(created,prompts),host={agent:PACKAGED_HI_AGENTS}
  const registry=new BackgroundRegistry(),scheduler=createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}}))
  const runtime=new TaskRuntime(opencodeChildPort(c),registry,scheduler,repoRoot,repoRoot,()=>resolveHiConfig({},repoRoot),()=>[{id:'provider/vision',provider:'provider',visionCapable:true,writeCapable:true}],()=>host)
  const store=new MissionStore(repoRoot),m=store.start('readonly-claim-zero-diff','inspect one file without changing it')
  store.applyInitialSemanticAssessment('readonly-claim-zero-diff',{material:true,message_kind:'mission',task_kind:'analysis',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['repository-exploration'],requested_external_actions:[],likely_verification:[],likely_targets:[EXISTING_READ_SCOPE],intent_signals:[],suppressed_intent_signals:[]})
  const started=await runtime.start(m,{objective:'inspect current runtime source',role:'repository-explorer',category:'quick',scope:[EXISTING_READ_SCOPE]})
  const task=m.execution.tasks.find(t=>t.id===started.task_id),worker=m.execution.workers.find(w=>w.id===started.worker_id);assert.ok(task);assert.ok(worker)
  worker.native_diff_baseline={};worker.native_diff_final={};worker.write_set=[]
  runtime.applyResult(m,worker.id,{status:'DONE',summary:'Read-only inspection complete.',changed_files:[EXISTING_READ_SCOPE],scope_expansions:[],evidence:[],open_issues:[],needs_context:[]})
  assert.equal(task.result?.status,'DONE');assert.deepEqual(task.result?.changed_files,[])
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.read-only-changed-files-claim-ignored'&&e.worker_id===worker.id))
})

test('read-only worker still fails closed when native diff proves a real mutation',async()=>{
  const created=[],prompts=[],c=client(created,prompts),host={agent:PACKAGED_HI_AGENTS}
  const registry=new BackgroundRegistry(),scheduler=createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}}))
  const runtime=new TaskRuntime(opencodeChildPort(c),registry,scheduler,repoRoot,repoRoot,()=>resolveHiConfig({},repoRoot),()=>[{id:'provider/vision',provider:'provider',visionCapable:true,writeCapable:true}],()=>host)
  const store=new MissionStore(repoRoot),m=store.start('readonly-claim-real-diff','inspect one file without changing it')
  store.applyInitialSemanticAssessment('readonly-claim-real-diff',{material:true,message_kind:'mission',task_kind:'analysis',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['repository-exploration'],requested_external_actions:[],likely_verification:[],likely_targets:[EXISTING_READ_SCOPE],intent_signals:[],suppressed_intent_signals:[]})
  const started=await runtime.start(m,{objective:'inspect current runtime source',role:'repository-explorer',category:'quick',scope:[EXISTING_READ_SCOPE]})
  const task=m.execution.tasks.find(t=>t.id===started.task_id),worker=m.execution.workers.find(w=>w.id===started.worker_id);assert.ok(task);assert.ok(worker)
  worker.native_diff_baseline={};worker.native_diff_final={[EXISTING_READ_SCOPE]:'changed'};worker.write_set=[EXISTING_READ_SCOPE]
  runtime.applyResult(m,worker.id,{status:'DONE',summary:'Read-only inspection complete.',changed_files:[EXISTING_READ_SCOPE],scope_expansions:[],evidence:[],open_issues:[],needs_context:[]})
  assert.equal(task.result?.status,'FIX_REQUIRED');assert.ok(task.result?.open_issues.some(x=>x.startsWith('diff-cleanliness:')))
})
