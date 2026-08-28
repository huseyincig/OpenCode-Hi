import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createTask,createWorker,beginWorkerAttempt} from '../dist/runtime/worker/worker-runtime.js'
import {createHiToolSurface} from '../dist/runtime/application/hi-tool-surface.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {detectOpenCodeCapabilities} from '../dist/opencode/capabilities.js'
import {browserObservationId} from '../dist/contracts/browser-observation.js'
import {methodologyExitCheck} from '../dist/runtime/methodology/exit.js'
import {opencodeChildPort} from './helpers/host-port.mjs'
import {ContextArtifactStore} from '../dist/runtime/context/artifact-store.js'
import {createRuntimeScopedStores} from '../dist/runtime/application/runtime-scoped-stores.js'
import {normalizeWorkerResult} from '../dist/contracts/worker-result.js'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

function fixture(id='m13-browser-proof'){
  const store=new MissionStore(),m=store.start(id,'verify browser evidence provenance')
  store.applyInitialSemanticAssessment(id,{material:true,message_kind:'mission',task_kind:'review',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['visual-review'],requested_external_actions:[],likely_verification:['visual-evidence'],likely_targets:['src/view.tsx'],intent_signals:['intent.browser'],suppressed_intent_signals:[]})
  const task=createTask(m,{objective:'verify UI',role:'visual-qa',category:'visual',scope:['src/view.tsx'],requiredEvidence:['visual-evidence'],obligationIds:[],executionProfile:{role:'visual-qa',category:'visual',task:{objective:'verify UI',scope:['src/view.tsx'],dependencies:[],required_evidence:['visual-evidence']},tools:['hi_browser_inspect'],fallback_models:[],methodologies:['hi-browser-testing'],permission_profile:{skill_tool_enabled:true,skill_permissions:{'hi-browser-testing':'allow'},external_effects:'parent-only',recursive_task:'deny'},verification_policy:{requiredKinds:['visual-evidence'],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:true},max_context_chars:12000,max_handoff_chars:12000,max_result_chars:6000,max_artifacts:8,browser_backend:'bounded-playwright',browser_allowed_origins:['http://127.0.0.1:4173']}})
  const worker=createWorker(m,task,'host-default',[],['hi-browser-testing']);worker.session_id=`${id}-child`;worker.status='busy';worker.loaded_methodologies=['hi-browser-testing'];beginWorkerAttempt(task,worker,Date.now()-10)
  return{store,m,task,worker}
}
function runtime(scopedStores){const client={session:{abort:async()=>({data:true}),diff:async()=>({data:[]})}};return new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}),undefined,{},scopedStores)}
function observation(taskID){const x={task_id:taskID,executor_version:'hi-playwright-browser@1',url:'http://127.0.0.1:4173/',action:'inspect',timestamp:Date.now(),document_identity:createHash('sha256').update(`doc:${taskID}`).digest('hex'),dom_summary:'Ready',console_errors:[],network_errors:[],result:'OBSERVED'};return{...x,observation_id:browserObservationId(x)}}
function surface(f,browserExecutor){return createHiToolSurface({state:{config:structuredClone(DEFAULT_HI_CONFIG),hostConfig:{},openCodeVersion:'1.18.18'},store:f.store,tasks:{},processRuntime:{},browserExecutor,projectRoot:process.cwd(),capabilities:detectOpenCodeCapabilities({}),native:{},getModels:()=>[],scopedStores:{contextArtifacts:{}}}).toolSurface}

test('real Hi browser observation creates pending attempt-bound canonical evidence reference',async()=>{
  const f=fixture('m13-proof-observe'),toolSurface=surface(f,{inspect:async()=>observation(f.task.id),health:async()=>({available:true})})
  const out=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id}))
  assert.ok(out.evidence_ref);assert.equal(out.observation.task_id,f.task.id)
  const ev=f.m.execution.evidence.items.find(e=>e.id===out.evidence_ref);assert.ok(ev);assert.equal(ev.kind,'browser-evidence');assert.equal(ev.outcome,'pending');assert.equal(ev.task_id,f.task.id);assert.equal(ev.producer_attempt.worker_id,f.worker.id);assert.match(ev.source,/^browser:bo_/)
})

test('fabricated passed browser evidence without browser observation reference cannot satisfy browser methodology exit',()=>{
  const f=fixture('m13-proof-fabricated');runtime().applyResult(f.m,f.worker.id,{status:'DONE',summary:'browser passed',changed_files:[],evidence:[{kind:'browser-evidence',summary:'claimed pass',scope:['src/view.tsx'],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(f.task.result.status,'FIX_REQUIRED');assert.equal(f.task.result.evidence[0].outcome,'pending');assert.match(f.task.result.evidence[0].reason,/browser-proof-unbound/);assert.equal(methodologyExitCheck(f.m,'hi-browser-testing',{task:f.task,result:f.task.result,projectRoot:process.cwd(),scope:'worker'}).ok,false)
})

test('passed browser evidence accepts same-task current-attempt real browser observation reference',async()=>{
  const f=fixture('m13-proof-valid'),toolSurface=surface(f,{inspect:async()=>observation(f.task.id),health:async()=>({available:true})});const out=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id}))
  runtime().applyResult(f.m,f.worker.id,{status:'DONE',summary:'browser verified',changed_files:[],evidence:[{kind:'browser-evidence',summary:'verified against browser observation',scope:['src/view.tsx'],evidence_refs:[out.evidence_ref],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(f.task.result.status,'DONE');const passed=f.m.execution.evidence.items.find(e=>e.kind==='browser-evidence'&&e.outcome==='passed');assert.ok(passed);assert.deepEqual(passed.evidence_refs,[out.evidence_ref]);assert.match(passed.source_state_hash,/^[a-f0-9]{64}$/);assert.equal(methodologyExitCheck(f.m,'hi-browser-testing',{task:f.task,result:f.task.result,projectRoot:process.cwd(),scope:'worker'}).ok,true)
})



test('current-attempt preview-origin observation cannot satisfy browser proof bound to a different required live origin',async()=>{
  const f=fixture('m13-proof-target-mismatch');f.worker.selected_methodologies=['hi-visual-qa'];f.worker.loaded_methodologies=['hi-visual-qa'];f.task.execution_profile.methodologies=['hi-visual-qa'];f.task.execution_profile.browser_allowed_origins=['http://localhost:5000','http://127.0.0.1:39929'];f.task.execution_profile.browser_required_origins=['http://localhost:5000']
  const previewObservation=()=>{const x={...observation(f.task.id),url:'http://127.0.0.1:39929/templates/index.html'};x.observation_id=browserObservationId(x);return x}
  const toolSurface=surface(f,{inspect:async()=>previewObservation(),health:async()=>({available:true})}),out=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id}))
  const raw=f.m.execution.evidence.items.find(e=>e.id===out.evidence_ref);assert.equal(raw.browser_origin,'http://127.0.0.1:39929');assert.match(raw.browser_url,/templates\/index\.html/)
  runtime().applyResult(f.m,f.worker.id,{status:'DONE',summary:'preview-only visual claim',changed_files:[],evidence:[{kind:'visual-evidence',summary:'static preview looked correct',scope:['src/view.tsx'],evidence_refs:[out.evidence_ref],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(f.task.result.status,'FIX_REQUIRED');assert.equal(f.task.result.evidence[0].outcome,'pending');assert.ok(f.m.execution.ledger.some(e=>e.type==='browser.evidence-unbound'&&String(e.payload?.reason).includes('required live origin')))
  assert.equal(f.m.execution.evidence.items.some(e=>e.kind==='visual-evidence'&&e.outcome==='passed'),false)
})

test('current-attempt browser observation on the required live origin remains admissible',async()=>{
  const f=fixture('m13-proof-target-match');f.worker.selected_methodologies=['hi-visual-qa'];f.worker.loaded_methodologies=['hi-visual-qa'];f.task.execution_profile.methodologies=['hi-visual-qa'];f.task.execution_profile.browser_allowed_origins=['http://localhost:5000'];f.task.execution_profile.browser_required_origins=['http://localhost:5000']
  const liveObservation=()=>{const x={...observation(f.task.id),url:'http://localhost:5000/'};x.observation_id=browserObservationId(x);return x}
  const toolSurface=surface(f,{inspect:async()=>liveObservation(),health:async()=>({available:true})}),out=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id}))
  runtime().applyResult(f.m,f.worker.id,{status:'DONE',summary:'live target verified',changed_files:[],evidence:[{kind:'visual-evidence',summary:'live Flask UI verified',scope:['src/view.tsx'],evidence_refs:[out.evidence_ref],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(f.task.result.status,'DONE');const passed=f.m.execution.evidence.items.find(e=>e.kind==='visual-evidence'&&e.outcome==='passed');assert.ok(passed);assert.deepEqual(passed.evidence_refs,[out.evidence_ref])
})

test('browser observation reference from a prior worker attempt cannot satisfy current browser proof',async()=>{
  const f=fixture('m13-proof-stale'),toolSurface=surface(f,{inspect:async()=>observation(f.task.id),health:async()=>({available:true})});const out=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id}));beginWorkerAttempt(f.task,f.worker)
  runtime().applyResult(f.m,f.worker.id,{status:'DONE',summary:'stale browser proof',changed_files:[],evidence:[{kind:'browser-evidence',summary:'stale claim',scope:['src/view.tsx'],evidence_refs:[out.evidence_ref],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(f.task.result.status,'FIX_REQUIRED');assert.equal(f.task.result.evidence[0].outcome,'pending');assert.match(f.task.result.evidence[0].reason,/browser-proof-unbound/)
})


test('passed visual evidence keeps exact browser authority while verified Hi screenshot provenance is supplemental',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-browser-mixed-proof-'))
  try{
    const f=fixture('m13-proof-mixed-artifact'),scopedStores=createRuntimeScopedStores(root);f.worker.selected_methodologies=['hi-visual-qa'];f.worker.loaded_methodologies=['hi-visual-qa'];f.task.execution_profile.methodologies=['hi-visual-qa'];const toolSurface=createHiToolSurface({state:{config:structuredClone(DEFAULT_HI_CONFIG),hostConfig:{},openCodeVersion:'1.18.21'},store:f.store,tasks:{},processRuntime:{},browserExecutor:{inspect:async()=>observation(f.task.id),health:async()=>({available:true})},projectRoot:root,capabilities:detectOpenCodeCapabilities({}),native:{},getModels:()=>[],scopedStores}).toolSurface
    const out=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id})),artifact=scopedStores.contextArtifacts.addBinary('browser-screenshot',`Browser screenshot for ${f.task.id}`,new Uint8Array([137,80,78,71,13,10,26,10,1]),{extension:'png',mediaType:'image/png',producer:'hi-browser-executor',consumerRefs:[`task:${f.task.id}`]})
    runtime(scopedStores).applyResult(f.m,f.worker.id,{status:'DONE',summary:'visual proof with screenshot provenance',changed_files:[],evidence:[{kind:'visual-evidence',summary:'verified browser-visible state',scope:['src/view.tsx'],evidence_refs:[out.evidence_ref,`hi-artifact:${artifact.artifact_id}`],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
    assert.equal(f.task.result.status,'DONE');assert.deepEqual(f.task.result.evidence[0].evidence_refs,[out.evidence_ref]);const normalized=f.m.execution.ledger.find(e=>e.type==='browser.evidence-ref-normalized');assert.ok(normalized);assert.deepEqual(normalized.payload.supplemental_refs,[`hi-artifact:${artifact.artifact_id}`])
  } finally {rmSync(root,{recursive:true,force:true})}
})


test('annotated current-attempt browser refs normalize at WorkerResult boundary and still require exact browser authority',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-browser-annotated-proof-'))
  try{
    const f=fixture('m13-proof-annotated'),scopedStores=createRuntimeScopedStores(root);f.worker.selected_methodologies=['hi-visual-qa'];f.worker.loaded_methodologies=['hi-visual-qa'];f.task.execution_profile.methodologies=['hi-visual-qa']
    const toolSurface=createHiToolSurface({state:{config:structuredClone(DEFAULT_HI_CONFIG),hostConfig:{},openCodeVersion:'1.18.21'},store:f.store,tasks:{},processRuntime:{},browserExecutor:{inspect:async()=>observation(f.task.id),health:async()=>({available:true})},projectRoot:root,capabilities:detectOpenCodeCapabilities({}),native:{},getModels:()=>[],scopedStores}).toolSurface
    const out=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id})),artifact=scopedStores.contextArtifacts.addBinary('browser-screenshot',`Browser screenshot for ${f.task.id}`,new Uint8Array([137,80,78,71,13,10,26,10,9]),{extension:'png',mediaType:'image/png',producer:'hi-browser-executor',consumerRefs:[`task:${f.task.id}`]})
    const result=normalizeWorkerResult({status:'DONE',summary:'annotated visual proof',changed_files:[],evidence:[{kind:'visual-evidence',summary:'verified state',scope:['src/view.tsx'],evidence_refs:[`${out.evidence_ref} -> hi-artifact:${artifact.artifact_id} screenshot 1280x800`],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
    runtime(scopedStores).applyResult(f.m,f.worker.id,result)
    assert.equal(f.task.result.status,'DONE');assert.deepEqual(f.task.result.evidence[0].evidence_refs,[out.evidence_ref]);assert.equal(methodologyExitCheck(f.m,'hi-visual-qa',{task:f.task,result:f.task.result,projectRoot:root,scope:'worker'}).ok,true)
  } finally {rmSync(root,{recursive:true,force:true})}
})

test('verified Hi screenshot artifact alone cannot satisfy browser proof authority',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-browser-artifact-only-'))
  try{
    const f=fixture('m13-proof-artifact-only'),scopedStores=createRuntimeScopedStores(root),artifact=scopedStores.contextArtifacts.addBinary('browser-screenshot',`Browser screenshot for ${f.task.id}`,new Uint8Array([137,80,78,71,13,10,26,10,2]),{extension:'png',mediaType:'image/png',producer:'hi-browser-executor',consumerRefs:[`task:${f.task.id}`]})
    runtime(scopedStores).applyResult(f.m,f.worker.id,{status:'DONE',summary:'artifact-only claim',changed_files:[],evidence:[{kind:'browser-evidence',summary:'screenshot only',scope:['src/view.tsx'],evidence_refs:[`hi-artifact:${artifact.artifact_id}`],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
    assert.equal(f.task.result.status,'FIX_REQUIRED');assert.equal(f.task.result.evidence[0].outcome,'pending');assert.match(f.task.result.evidence[0].reason,/browser-proof-unbound/)
  } finally {rmSync(root,{recursive:true,force:true})}
})

test('fabricated Hi artifact and arbitrary unresolved refs remain fail-closed beside valid browser evidence',async()=>{
  for(const badRef of ['hi-artifact:a_fabricatedbrowserproof','not-a-canonical-evidence-ref']){
    const f=fixture(`m13-proof-bad-mixed-${badRef.startsWith('hi-')?'artifact':'arbitrary'}`),toolSurface=surface(f,{inspect:async()=>observation(f.task.id),health:async()=>({available:true})}),out=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id}))
    runtime().applyResult(f.m,f.worker.id,{status:'DONE',summary:'mixed bad ref',changed_files:[],evidence:[{kind:'browser-evidence',summary:'valid observation plus invalid ref',scope:['src/view.tsx'],evidence_refs:[out.evidence_ref,badRef],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
    assert.equal(f.task.result.status,'FIX_REQUIRED',badRef);assert.equal(f.task.result.evidence[0].outcome,'pending',badRef);assert.match(f.task.result.evidence[0].reason,/browser-proof-unbound/,badRef)
  }
})

test('verified screenshot provenance cannot rescue a prior-attempt browser observation',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-browser-stale-plus-artifact-'))
  try{
    const f=fixture('m13-proof-stale-plus-artifact'),scopedStores=createRuntimeScopedStores(root),toolSurface=createHiToolSurface({state:{config:structuredClone(DEFAULT_HI_CONFIG),hostConfig:{},openCodeVersion:'1.18.21'},store:f.store,tasks:{},processRuntime:{},browserExecutor:{inspect:async()=>observation(f.task.id),health:async()=>({available:true})},projectRoot:root,capabilities:detectOpenCodeCapabilities({}),native:{},getModels:()=>[],scopedStores}).toolSurface
    const out=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id})),artifact=scopedStores.contextArtifacts.addBinary('browser-screenshot',`Browser screenshot for ${f.task.id}`,new Uint8Array([137,80,78,71,13,10,26,10,3]),{extension:'png',mediaType:'image/png',producer:'hi-browser-executor',consumerRefs:[`task:${f.task.id}`]});beginWorkerAttempt(f.task,f.worker)
    runtime(scopedStores).applyResult(f.m,f.worker.id,{status:'DONE',summary:'stale plus screenshot',changed_files:[],evidence:[{kind:'browser-evidence',summary:'stale observation plus verified screenshot',scope:['src/view.tsx'],evidence_refs:[out.evidence_ref,`hi-artifact:${artifact.artifact_id}`],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
    assert.equal(f.task.result.status,'FIX_REQUIRED');assert.equal(f.task.result.evidence[0].outcome,'pending');assert.match(f.task.result.evidence[0].reason,/browser-proof-unbound/)
  } finally {rmSync(root,{recursive:true,force:true})}
})


test('current-attempt browser observation id alias bo_... normalizes to canonical evidence ref',async()=>{
  const f=fixture('m13-proof-bo-alias'),toolSurface=surface(f,{inspect:async()=>observation(f.task.id),health:async()=>({available:true})});const out=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id}))
  runtime().applyResult(f.m,f.worker.id,{status:'DONE',summary:'browser verified via observation id alias',changed_files:[],evidence:[{kind:'browser-evidence',summary:'verified against exact browser observation id',scope:['src/view.tsx'],evidence_refs:[out.observation.observation_id],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(f.task.result.status,'DONE');assert.deepEqual(f.task.result.evidence[0].evidence_refs,[out.evidence_ref]);const normalized=f.m.execution.ledger.find(e=>e.type==='browser.evidence-ref-normalized');assert.ok(normalized);assert.deepEqual(normalized.payload.from,[out.observation.observation_id]);assert.deepEqual(normalized.payload.to,[out.evidence_ref])
})

test('stale prior-attempt browser observation id alias remains fail-closed',async()=>{
  const f=fixture('m13-proof-bo-stale'),toolSurface=surface(f,{inspect:async()=>observation(f.task.id),health:async()=>({available:true})});const out=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id}));beginWorkerAttempt(f.task,f.worker)
  runtime().applyResult(f.m,f.worker.id,{status:'DONE',summary:'stale observation-id alias',changed_files:[],evidence:[{kind:'browser-evidence',summary:'stale claim',scope:['src/view.tsx'],evidence_refs:[out.observation.observation_id],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(f.task.result.status,'FIX_REQUIRED');assert.equal(f.task.result.evidence[0].outcome,'pending');assert.match(f.task.result.evidence[0].reason,/browser-proof-unbound/);assert.equal(f.m.execution.ledger.some(e=>e.type==='browser.evidence-ref-normalized'),false)
})



test('visual verification case coverage rejects rerun6-shaped DONE when required navigate action was never observed',async()=>{
  const f=fixture('m13-coverage-missing-navigate');f.task.verification_cases=[{id:'vc_reload',subject:'theme survives reload',required_browser_actions:['navigate','inspect']}];f.task.execution_profile.task.verification_cases=structuredClone(f.task.verification_cases);f.worker.selected_methodologies=['hi-visual-qa'];f.worker.loaded_methodologies=['hi-visual-qa'];f.task.execution_profile.methodologies=['hi-visual-qa']
  const toolSurface=surface(f,{inspect:async()=>observation(f.task.id),health:async()=>({available:true})}),inspected=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id}))
  runtime().applyResult(f.m,f.worker.id,normalizeWorkerResult({status:'DONE',summary:'most visual checks passed but reload was not exercised',changed_files:[],evidence:[{kind:'visual-evidence',summary:'partial visual pass',scope:['src/view.tsx'],evidence_refs:[inspected.evidence_ref],pass:true,outcome:'passed'}],verification_coverage:[{case_id:'vc_reload',outcome:'passed',evidence_refs:[inspected.evidence_ref]}],open_issues:[],needs_context:[]}))
  assert.equal(f.task.result.status,'FIX_REQUIRED');assert.ok(f.task.result.open_issues.some(x=>x.includes('vc_reload:missing-actions=navigate')));assert.equal(f.task.result.evidence[0].outcome,'pending');assert.equal(f.m.execution.evidence.items.some(e=>e.kind==='visual-evidence'&&e.outcome==='passed'),false);assert.ok(f.m.execution.ledger.some(e=>e.type==='visual.coverage-rejected'))
})

test('shortened visual evidence ref remains rejected but receives an exact format correction hint without weakening provenance',async()=>{
  const f=fixture('m13-coverage-short-ref');f.task.verification_cases=[{id:'vc_reload',subject:'theme survives reload',required_browser_actions:['inspect']}];f.task.execution_profile.task.verification_cases=structuredClone(f.task.verification_cases);f.worker.selected_methodologies=['hi-visual-qa'];f.worker.loaded_methodologies=['hi-visual-qa'];f.task.execution_profile.methodologies=['hi-visual-qa']
  const toolSurface=surface(f,{inspect:async()=>observation(f.task.id),health:async()=>({available:true})}),inspected=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id})),full=inspected.evidence_ref,short=full.replace(/_[^_]+$/,'')
  assert.notEqual(short,full);assert.ok(full.startsWith(short))
  runtime().applyResult(f.m,f.worker.id,normalizeWorkerResult({status:'DONE',summary:'browser behavior passed but ref was abbreviated',changed_files:[],evidence:[{kind:'visual-evidence',summary:'visual behavior passed',scope:['src/view.tsx'],evidence_refs:[full],pass:true,outcome:'passed'}],verification_coverage:[{case_id:'vc_reload',outcome:'passed',evidence_refs:[short]}],open_issues:[],needs_context:[]}))
  assert.equal(f.task.result.status,'FIX_REQUIRED');assert.ok(f.task.result.open_issues.some(x=>x.includes('vc_reload:unbound-refs')));const correction=f.task.result.needs_context.find(x=>x.startsWith('visual-evidence-ref-correction:'));assert.ok(correction);assert.match(correction,new RegExp(`${short}->${full}`));assert.match(correction,/Prefixes\/abbreviations are never accepted/);assert.match(correction,/new attempt/);assert.equal(f.m.execution.evidence.items.some(e=>e.kind==='visual-evidence'&&e.outcome==='passed'),false)
  const rejected=f.m.execution.ledger.find(e=>e.type==='visual.coverage-rejected');assert.ok(rejected);assert.deepEqual(rejected.payload.unbound_refs,[{case_id:'vc_reload',invalid_refs:'[bounded]',unique_prefix_corrections:'[bounded]'}],'ledger sanitizer preserves case identity while bounding nested ref-bearing payloads; exact correction remains in task needs_context')
})

test('unbound visual evidence ref with no unique current-attempt match remains fail-closed without fabricated correction',async()=>{
  const f=fixture('m13-coverage-unmatched-ref');f.task.verification_cases=[{id:'vc_reload',subject:'theme survives reload',required_browser_actions:['inspect']}];f.task.execution_profile.task.verification_cases=structuredClone(f.task.verification_cases);f.worker.selected_methodologies=['hi-visual-qa'];f.worker.loaded_methodologies=['hi-visual-qa'];f.task.execution_profile.methodologies=['hi-visual-qa']
  const toolSurface=surface(f,{inspect:async()=>observation(f.task.id),health:async()=>({available:true})}),inspected=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id})),bad='not-a-current-evidence-ref'
  runtime().applyResult(f.m,f.worker.id,normalizeWorkerResult({status:'DONE',summary:'wrong ref',changed_files:[],evidence:[{kind:'visual-evidence',summary:'real visual evidence exists',scope:['src/view.tsx'],evidence_refs:[inspected.evidence_ref],pass:true,outcome:'passed'}],verification_coverage:[{case_id:'vc_reload',outcome:'passed',evidence_refs:[bad]}],open_issues:[],needs_context:[]}))
  assert.equal(f.task.result.status,'FIX_REQUIRED');const correction=f.task.result.needs_context.find(x=>x.startsWith('visual-evidence-ref-correction:'));assert.ok(correction);assert.match(correction,new RegExp(`vc_reload:${bad}`));assert.doesNotMatch(correction,/unique-prefix format examples:/);const rejected=f.m.execution.ledger.find(e=>e.type==='visual.coverage-rejected');assert.ok(rejected);assert.deepEqual(rejected.payload.unbound_refs,[{case_id:'vc_reload',invalid_refs:'[bounded]',unique_prefix_corrections:'[bounded]'}])
})

test('duplicate visual verification coverage claims cannot gain last-write-wins completion authority',async()=>{
  const f=fixture('m13-coverage-duplicate');f.task.verification_cases=[{id:'vc_reload',subject:'theme survives reload',required_browser_actions:['inspect']}];f.task.execution_profile.task.verification_cases=structuredClone(f.task.verification_cases);f.worker.selected_methodologies=['hi-visual-qa'];f.worker.loaded_methodologies=['hi-visual-qa'];f.task.execution_profile.methodologies=['hi-visual-qa'];const toolSurface=surface(f,{inspect:async()=>observation(f.task.id),health:async()=>({available:true})}),inspected=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id})),claim={case_id:'vc_reload',outcome:'passed',evidence_refs:[inspected.evidence_ref]};runtime().applyResult(f.m,f.worker.id,{status:'DONE',summary:'duplicate claims',changed_files:[],evidence:[{kind:'visual-evidence',summary:'visual pass',scope:['src/view.tsx'],evidence_refs:[inspected.evidence_ref],pass:true,outcome:'passed'}],verification_coverage:[claim,{...claim}],open_issues:[],needs_context:[]});assert.equal(f.task.result.status,'FIX_REQUIRED');assert.ok(f.task.result.open_issues.some(x=>x.includes('duplicate-cases=vc_reload')));assert.equal(f.m.execution.evidence.items.some(e=>e.kind==='visual-evidence'&&e.outcome==='passed'),false)
})

test('visual verification case coverage admits DONE only when every required current-attempt browser action is cited',async()=>{
  const f=fixture('m13-coverage-complete');f.task.verification_cases=[{id:'vc_reload',subject:'theme survives reload',required_browser_actions:['navigate','inspect']}];f.task.execution_profile.task.verification_cases=structuredClone(f.task.verification_cases);f.worker.selected_methodologies=['hi-visual-qa'];f.worker.loaded_methodologies=['hi-visual-qa'];f.task.execution_profile.methodologies=['hi-visual-qa']
  const nav=()=>{const x={...observation(f.task.id),action:'navigate',url:'http://127.0.0.1:4173/?reload=1'};x.observation_id=browserObservationId(x);return x},toolSurface=surface(f,{navigate:async()=>nav(),inspect:async()=>observation(f.task.id),health:async()=>({available:true})}),navigated=JSON.parse(await toolSurface.hi_browser_navigate.execute({task_id:f.task.id,url:'http://127.0.0.1:4173/?reload=1'},{sessionID:f.worker.session_id})),inspected=JSON.parse(await toolSurface.hi_browser_inspect.execute({task_id:f.task.id},{sessionID:f.worker.session_id})),refs=[navigated.evidence_ref,inspected.evidence_ref]
  runtime().applyResult(f.m,f.worker.id,normalizeWorkerResult({status:'DONE',summary:'reload persistence exercised and observed',changed_files:[],evidence:[{kind:'visual-evidence',summary:'complete visual pass',scope:['src/view.tsx'],evidence_refs:refs,pass:true,outcome:'passed'}],verification_coverage:[{case_id:'vc_reload',outcome:'passed',evidence_refs:refs}],open_issues:[],needs_context:[]}))
  assert.equal(f.task.result.status,'DONE');assert.ok(f.m.execution.evidence.items.some(e=>e.kind==='visual-evidence'&&e.outcome==='passed'));assert.ok(f.m.execution.ledger.some(e=>e.type==='visual.coverage-admitted'))
})

test('screenshot tool returns canonical ref plus native image attachment instead of a filesystem lookup target',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-browser-attachment-'))
  try{
    const f=fixture('m13-proof-screenshot-attachment'),artifacts=new ContextArtifactStore(root),bytes=new Uint8Array([137,80,78,71,13,10,26,10,7,8,9]),stored=artifacts.addBinary('browser-screenshot',`Browser screenshot for ${f.task.id}`,bytes,{extension:'png',mediaType:'image/png',producer:'hi-browser-executor',consumerRefs:[`task:${f.task.id}`]})
    const x={task_id:f.task.id,executor_version:'hi-playwright-browser@1',url:'http://127.0.0.1:4173/',action:'screenshot',timestamp:Date.now(),console_errors:[],network_errors:[],screenshot_artifact_ref:`hi-artifact:${stored.artifact_id}`,result:'OBSERVED'};x.observation_id=browserObservationId(x)
    const toolSurface=createHiToolSurface({state:{config:structuredClone(DEFAULT_HI_CONFIG),hostConfig:{},openCodeVersion:'1.18.21'},store:f.store,tasks:{},processRuntime:{},browserExecutor:{screenshot:async()=>x,health:async()=>({available:true})},projectRoot:root,capabilities:detectOpenCodeCapabilities({}),native:{},getModels:()=>[],scopedStores:{contextArtifacts:artifacts}}).toolSurface
    const result=await toolSurface.hi_browser_screenshot.execute({task_id:f.task.id},{sessionID:f.worker.session_id})
    assert.equal(typeof result,'object')
    const payload=JSON.parse(result.output)
    assert.equal(payload.observation.screenshot_artifact_ref,`hi-artifact:${stored.artifact_id}`)
    assert.ok(payload.evidence_ref)
    assert.deepEqual(result.attachments?.map(a=>({type:a.type,mime:a.mime,filename:a.filename})),[{type:'file',mime:'image/png',filename:`${stored.artifact_id}.png`}])
    assert.equal(result.attachments?.[0]?.url,`data:image/png;base64,${Buffer.from(bytes).toString('base64')}`)
    assert.doesNotMatch(result.output,/\.opencode\/hi\/artifacts/)
  } finally {rmSync(root,{recursive:true,force:true})}
})
