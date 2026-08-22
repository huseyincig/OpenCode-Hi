import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createTask,createWorker,beginWorkerAttempt} from '../dist/runtime/worker/worker-runtime.js'
import {createHiToolSurface} from '../dist/runtime/application/hi-tool-surface.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {detectOpenCodeCapabilities} from '../dist/opencode/capabilities.js'
import {browserObservationId} from '../dist/contracts/browser-observation.js'
import {methodologyExitCheck} from '../dist/runtime/methodology/exit.js'
import {opencodeChildPort} from './helpers/host-port.mjs'

function fixture(id='m13-browser-proof'){
  const store=new MissionStore(),m=store.start(id,'verify browser evidence provenance')
  store.applyInitialSemanticAssessment(id,{material:true,message_kind:'mission',task_kind:'review',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['visual-review'],requested_external_actions:[],likely_verification:['visual-evidence'],likely_targets:['src/view.tsx'],intent_signals:['intent.browser'],suppressed_intent_signals:[]})
  const task=createTask(m,{objective:'verify UI',role:'visual-qa',category:'visual',scope:['src/view.tsx'],requiredEvidence:['visual-evidence'],obligationIds:[],executionProfile:{role:'visual-qa',category:'visual',task:{objective:'verify UI',scope:['src/view.tsx'],dependencies:[],required_evidence:['visual-evidence']},tools:['hi_browser_inspect'],fallback_models:[],methodologies:['hi-browser-testing'],permission_profile:{skill_tool_enabled:true,skill_permissions:{'hi-browser-testing':'allow'},external_effects:'parent-only',recursive_task:'deny'},verification_policy:{requiredKinds:['visual-evidence'],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:true},max_context_chars:12000,max_handoff_chars:12000,max_result_chars:6000,max_artifacts:8,browser_backend:'bounded-playwright',browser_allowed_origins:['http://127.0.0.1:4173']}})
  const worker=createWorker(m,task,'host-default',[],['hi-browser-testing']);worker.session_id=`${id}-child`;worker.status='busy';worker.loaded_methodologies=['hi-browser-testing'];beginWorkerAttempt(task,worker,Date.now()-10)
  return{store,m,task,worker}
}
function runtime(){const client={session:{abort:async()=>({data:true}),diff:async()=>({data:[]})}};return new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}),undefined,{},undefined)}
function observation(taskID){const x={task_id:taskID,executor_version:'hi-playwright-browser@1',url:'http://127.0.0.1:4173/',action:'inspect',timestamp:Date.now(),document_identity:createHash('sha256').update(`doc:${taskID}`).digest('hex'),dom_summary:'Ready',console_errors:[],network_errors:[],result:'OBSERVED'};return{...x,observation_id:browserObservationId(x)}}
function surface(f,browserExecutor){return createHiToolSurface({state:{config:structuredClone(DEFAULT_HI_CONFIG),hostConfig:{},openCodeVersion:'1.18.18'},store:f.store,tasks:{},processRuntime:{},browserExecutor,projectRoot:process.cwd(),capabilities:detectOpenCodeCapabilities({}),native:{},getModels:()=>[],scopedStores:{contextArtifacts:{}}}).toolSurface}

test('M13 real Hi browser observation creates pending attempt-bound canonical evidence reference',async()=>{
  const f=fixture('m13-proof-observe'),toolSurface=surface(f,{inspect:async()=>observation(f.task.id),health:async()=>({available:true})})
  const out=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id}))
  assert.ok(out.evidence_ref);assert.equal(out.observation.task_id,f.task.id)
  const ev=f.m.execution.evidence.items.find(e=>e.id===out.evidence_ref);assert.ok(ev);assert.equal(ev.kind,'browser-evidence');assert.equal(ev.outcome,'pending');assert.equal(ev.task_id,f.task.id);assert.equal(ev.producer_attempt.worker_id,f.worker.id);assert.match(ev.source,/^browser:bo_/)
})

test('M13 fabricated passed browser evidence without browser observation reference cannot satisfy browser methodology exit',()=>{
  const f=fixture('m13-proof-fabricated');runtime().applyResult(f.m,f.worker.id,{status:'DONE',summary:'browser passed',changed_files:[],evidence:[{kind:'browser-evidence',summary:'claimed pass',scope:['src/view.tsx'],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(f.task.result.status,'FIX_REQUIRED');assert.equal(f.task.result.evidence[0].outcome,'pending');assert.match(f.task.result.evidence[0].reason,/browser-proof-unbound/);assert.equal(methodologyExitCheck(f.m,'hi-browser-testing',{task:f.task,result:f.task.result,projectRoot:process.cwd(),scope:'worker'}).ok,false)
})

test('M13 passed browser evidence accepts same-task current-attempt real browser observation reference',async()=>{
  const f=fixture('m13-proof-valid'),toolSurface=surface(f,{inspect:async()=>observation(f.task.id),health:async()=>({available:true})});const out=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id}))
  runtime().applyResult(f.m,f.worker.id,{status:'DONE',summary:'browser verified',changed_files:[],evidence:[{kind:'browser-evidence',summary:'verified against browser observation',scope:['src/view.tsx'],evidence_refs:[out.evidence_ref],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(f.task.result.status,'DONE');const passed=f.m.execution.evidence.items.find(e=>e.kind==='browser-evidence'&&e.outcome==='passed');assert.ok(passed);assert.deepEqual(passed.evidence_refs,[out.evidence_ref]);assert.match(passed.source_state_hash,/^[a-f0-9]{64}$/);assert.equal(methodologyExitCheck(f.m,'hi-browser-testing',{task:f.task,result:f.task.result,projectRoot:process.cwd(),scope:'worker'}).ok,true)
})

test('M13 browser observation reference from a prior worker attempt cannot satisfy current browser proof',async()=>{
  const f=fixture('m13-proof-stale'),toolSurface=surface(f,{inspect:async()=>observation(f.task.id),health:async()=>({available:true})});const out=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id}));beginWorkerAttempt(f.task,f.worker)
  runtime().applyResult(f.m,f.worker.id,{status:'DONE',summary:'stale browser proof',changed_files:[],evidence:[{kind:'browser-evidence',summary:'stale claim',scope:['src/view.tsx'],evidence_refs:[out.evidence_ref],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(f.task.result.status,'FIX_REQUIRED');assert.equal(f.task.result.evidence[0].outcome,'pending');assert.match(f.task.result.evidence[0].reason,/browser-proof-unbound/)
})


test('M13 current-attempt browser observation id alias bo_... normalizes to canonical evidence ref',async()=>{
  const f=fixture('m13-proof-bo-alias'),toolSurface=surface(f,{inspect:async()=>observation(f.task.id),health:async()=>({available:true})});const out=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id}))
  runtime().applyResult(f.m,f.worker.id,{status:'DONE',summary:'browser verified via observation id alias',changed_files:[],evidence:[{kind:'browser-evidence',summary:'verified against exact browser observation id',scope:['src/view.tsx'],evidence_refs:[out.observation.observation_id],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(f.task.result.status,'DONE');assert.deepEqual(f.task.result.evidence[0].evidence_refs,[out.evidence_ref]);const normalized=f.m.execution.ledger.find(e=>e.type==='browser.evidence-ref-normalized');assert.ok(normalized);assert.deepEqual(normalized.payload.from,[out.observation.observation_id]);assert.deepEqual(normalized.payload.to,[out.evidence_ref])
})

test('M13 stale prior-attempt browser observation id alias remains fail-closed',async()=>{
  const f=fixture('m13-proof-bo-stale'),toolSurface=surface(f,{inspect:async()=>observation(f.task.id),health:async()=>({available:true})});const out=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id}));beginWorkerAttempt(f.task,f.worker)
  runtime().applyResult(f.m,f.worker.id,{status:'DONE',summary:'stale observation-id alias',changed_files:[],evidence:[{kind:'browser-evidence',summary:'stale claim',scope:['src/view.tsx'],evidence_refs:[out.observation.observation_id],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(f.task.result.status,'FIX_REQUIRED');assert.equal(f.task.result.evidence[0].outcome,'pending');assert.match(f.task.result.evidence[0].reason,/browser-proof-unbound/);assert.equal(f.m.execution.ledger.some(e=>e.type==='browser.evidence-ref-normalized'),false)
})
