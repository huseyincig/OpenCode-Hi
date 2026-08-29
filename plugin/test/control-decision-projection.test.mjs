import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { projectControlDecision } from '../dist/runtime/completion/control-projection.js'
import { buildMissionRuntimeProjection } from '../dist/runtime/context/mission-runtime-projection.js'
import { createTask,createWorker } from '../dist/runtime/worker/worker-runtime.js'
import { observeToolAfter,addEvidence } from '../dist/runtime/evidence/evidence-runtime.js'
import { createHiToolSurface } from '../dist/runtime/application/hi-tool-surface.js'
import { detectOpenCodeCapabilities } from '../dist/opencode/capabilities.js'
import { DEFAULT_HI_CONFIG } from '../dist/config/defaults.js'
import { startAssessedMission } from './helpers/semantic.mjs'

function localMission(sessionID='phase6-control'){
  const store=new MissionStore()
  const m=startAssessedMission(store,sessionID,'Create one bounded file and verify it.',{
    task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',
    required_capabilities:['implementation'],likely_verification:['changed-surface-sanity'],likely_targets:['phase6.txt']
  })
  return{store,m}
}
function closeImplementation(m){const o=m.execution.obligations.find(x=>x.id==='o-implementation');assert.ok(o);o.status='closed';o.closedAt=Date.now()}

test('control projection exposes exact evidence-owned VERIFY gap without creating state',()=>{
  const {m}=localMission('phase6-verify');closeImplementation(m)
  const before=JSON.stringify({tasks:m.execution.tasks,workers:m.execution.workers,evidence:m.execution.evidence,context:m.context})
  const decision=projectControlDecision(m)
  assert.equal(decision.action,'VERIFY');assert.equal(decision.completion_ready,false)
  assert.deepEqual(decision.wait_for,[])
  assert.deepEqual(decision.missing_evidence,[{obligation_id:'o-verification',kind:'changed-surface-sanity',result:'not_run'}])
  assert.deepEqual(decision.ineffective_actions,['hi_direct_progress','hi_context_artifact_add','worker-result-pass-claim'])
  assert.ok(JSON.stringify(decision).length<900,'decision projection must remain compact')
  assert.equal(JSON.stringify({tasks:m.execution.tasks,workers:m.execution.workers,evidence:m.execution.evidence,context:m.context}),before,'read-time projection must not create task/evidence/context state')
  const runtime=buildMissionRuntimeProjection(m)
  assert.match(runtime.next_action,/^verify:changed-surface-sanity; route=unknown; evidence-owned;/)
  assert.match(runtime.next_action,/hi_direct_progress/)
})

test('control projection reports active child work as WAIT and suppresses verification ceremony',()=>{
  const {m}=localMission('phase6-wait');closeImplementation(m)
  const task=createTask(m,{objective:'verify later after implementation',role:'coder',category:'quick',scope:['phase6.txt'],obligationIds:['o-verification']})
  const worker=createWorker(m,task,'host-default');task.status='running';worker.status='busy'
  const decision=projectControlDecision(m)
  assert.equal(decision.action,'WAIT')
  assert.ok(decision.wait_for.includes(`worker:${worker.id}:busy`))
  assert.ok(decision.wait_for.includes(`task:${task.id}:running`))
  assert.deepEqual(decision.missing_evidence,[],'do not invite verification work while canonical execution is active')
})

test('deadline-less persistent service does not mask verification and is excluded from WAIT projection',()=>{
  const {m}=localMission('phase6-persistent-verify');closeImplementation(m)
  m.execution.processes.push({process_id:'proc-service',mission_id:m.identity.mission_id,task_id:'t-service',worker_id:'w-service',host:'opencode',command_identity:'a'.repeat(64),cwd:process.cwd(),pid:4242,status:'RUNNING',started_at:Date.now(),output_artifact_refs:[],authority_ref:'native',cleanup_state:'ACTIVE'})
  const decision=projectControlDecision(m,process.cwd());assert.equal(decision.action,'VERIFY');assert.deepEqual(decision.wait_for,[])
})


test('visual VERIFY projects exact retained live service origin and forbids static preview substitution',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'phase6-live-origin','Implement and visually verify the live UI.',{task_kind:'implementation',scope:'multi-file',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','verification','visual-qa'],likely_verification:['visual-check'],likely_targets:['app.py','templates/index.html']});closeImplementation(m)
  m.execution.processes.push({process_id:'proc-live-origin',mission_id:m.identity.mission_id,task_id:'t-service',worker_id:'w-service',host:'opencode',command_identity:'d'.repeat(64),cwd:process.cwd(),pid:4250,status:'RUNNING',started_at:Date.now(),output_artifact_refs:[],service_origins:['http://127.0.0.1:5000'],authority_ref:'native',cleanup_state:'ACTIVE'})
  const decision=projectControlDecision(m,process.cwd());assert.equal(decision.action,'VERIFY');const runtime=buildMissionRuntimeProjection(m,undefined,process.cwd());assert.match(runtime.next_action,/browser_required_origins=http:\/\/127\.0\.0\.1:5000/);assert.match(runtime.next_action,/hi_browser_preview_open cannot substitute/)
})

test('visual VERIFY with unregistered live process target requests one bounded process read and forbids preview',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'phase6-live-unregistered','Implement and visually verify the live UI.',{task_kind:'implementation',scope:'multi-file',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','verification','visual-qa'],likely_verification:['visual-check'],likely_targets:['app.py','templates/index.html']});closeImplementation(m)
  m.execution.processes.push({process_id:'proc-live-unregistered',mission_id:m.identity.mission_id,task_id:'t-service',worker_id:'w-service',host:'opencode',command_identity:'e'.repeat(64),cwd:process.cwd(),pid:4251,status:'RUNNING',started_at:Date.now(),output_artifact_refs:[],authority_ref:'native',cleanup_state:'ACTIVE'})
  const runtime=buildMissionRuntimeProjection(m,undefined,process.cwd());assert.match(runtime.next_action,/live-service-target-unregistered:proc-live-unregistered/);assert.match(runtime.next_action,/hi_process_read once/);assert.match(runtime.next_action,/static preview is forbidden/)
})

test('persistent service projects exact kill then cleanup after obligations are satisfied',()=>{
  const {m}=localMission('phase6-persistent-cleanup');closeImplementation(m)
  observeToolAfter(m,'bash',{command:'npm run check'},{stdout:'check passed',metadata:{exit:0}},process.cwd())
  m.execution.processes.push({process_id:'proc-service-clean',mission_id:m.identity.mission_id,task_id:'t-service',worker_id:'w-service',host:'opencode',command_identity:'b'.repeat(64),cwd:process.cwd(),pid:4243,status:'RUNNING',started_at:Date.now(),output_artifact_refs:[],authority_ref:'native',cleanup_state:'ACTIVE'})
  const decision=projectControlDecision(m,process.cwd());assert.equal(decision.action,'CONTINUE');assert.deepEqual(decision.open_obligations,[])
  const runtime=buildMissionRuntimeProjection(m);assert.match(runtime.next_action,/cleanup-persistent-process:proc-service-clean/);assert.match(runtime.next_action,/hi_process_kill id=proc-service-clean/);assert.match(runtime.next_action,/hi_process_cleanup id=proc-service-clean/);assert.match(runtime.next_action,/do not call hi_process_wait/i)
})

test('waiting FIX_REQUIRED task is RECONCILE, not a false WAIT',()=>{
  const {m}=localMission('phase6-reconcile');closeImplementation(m)
  addEvidence(m,{kind:'changed-surface-sanity',summary:'current exact host check passed',scope:['phase6.txt'],source:'bash',trusted_source_class:'host-tool-observation',pass:true,outcome:'passed',obligation_ids:['o-verification']})
  const verify=m.execution.obligations.find(x=>x.id==='o-verification');assert.ok(verify);verify.status='closed';verify.closedAt=Date.now()
  const task=createTask(m,{objective:'reconcile bounded correction',role:'coder',category:'quick',scope:['phase6.txt']})
  const worker=createWorker(m,task,'host-default');task.status='waiting';worker.status='ready';task.result={status:'FIX_REQUIRED',summary:'one exact correction remains',changed_files:['phase6.txt'],evidence:[],open_issues:['bounded-fix'],needs_context:[]}
  const decision=projectControlDecision(m)
  assert.equal(decision.action,'RECONCILE')
  assert.deepEqual(decision.wait_for,[])
})

test('cancelled FIX_REQUIRED result remains provenance but cannot own RECONCILE control',()=>{
  const {m}=localMission('phase6-cancelled-result');closeImplementation(m)
  const task=createTask(m,{objective:'cancelled correction',role:'coder',category:'quick',scope:['phase6.txt']});const worker=createWorker(m,task,'host-default')
  task.status='cancelled';worker.status='cancelled';task.result={status:'FIX_REQUIRED',summary:'historical cancelled result',changed_files:[],evidence:[],open_issues:['historical-only'],needs_context:[]}
  const decision=projectControlDecision(m,process.cwd());assert.equal(decision.action,'VERIFY');assert.notEqual(decision.action,'RECONCILE')
})

test('host-observed verification moves the same projection from VERIFY to DONE',()=>{
  const {m}=localMission('phase6-done');closeImplementation(m)
  assert.equal(projectControlDecision(m).action,'VERIFY')
  observeToolAfter(m,'bash',{command:'npm run check'},{stdout:'check passed',metadata:{exit:0}},process.cwd())
  const decision=projectControlDecision(m)
  assert.equal(decision.action,'DONE');assert.equal(decision.completion_ready,true)
  assert.deepEqual(decision.missing_evidence,[]);assert.deepEqual(decision.open_obligations,[])
})

test('hi_task_await returns terminal WorkerResult and canonical mission control decision atomically',async()=>{
  const {store,m}=localMission('phase6-await');closeImplementation(m)
  const tasks={awaitTask:async()=>({status:'completed',terminal:true,changed:true,timed_out:false,task:{result:{status:'DONE',summary:'implementation done',changed_files:['phase6.txt'],evidence:[],open_issues:[],needs_context:[]}}})}
  const processRuntime={stopMission:async()=>0,list:()=>[]}
  const state={config:structuredClone(DEFAULT_HI_CONFIG),hostConfig:{},configResolution:undefined,openCodeVersion:'1.18.20'}
  const {toolSurface}=createHiToolSurface({state,store,tasks,processRuntime,projectRoot:process.cwd(),capabilities:detectOpenCodeCapabilities({}),native:{},getModels:()=>[],scopedStores:{contextArtifacts:{}}})
  const out=JSON.parse(await toolSurface.hi_task_await.execute({id:'t-terminal',timeout_ms:10},{sessionID:m.identity.session_id}))
  assert.equal(out.status,'completed');assert.equal(out.result.status,'DONE')
  assert.equal(out.control.action,'VERIFY')
  assert.deepEqual(out.control.missing_evidence,[{obligation_id:'o-verification',kind:'changed-surface-sanity',result:'not_run'}])
  assert.deepEqual(out.control.ineffective_actions,['hi_direct_progress','hi_context_artifact_add','worker-result-pass-claim'])
})



test('hi_task_await exposes cancellation only after bounded busy/no-progress stall admission',async()=>{
  const {store,m}=localMission('phase6-await-stall')
  const worker={id:'w-stalled',session_id:'s-stalled',attempt:1},task={id:'t-stalled',status:'running'}
  const tasks={awaitTask:async()=>({status:'running',terminal:false,changed:false,timed_out:true,live_status:'busy',progress_observed:false,worker,task}),modelCancelAdmission:async()=>({allowed:true,reason:'bounded-busy-no-progress-stall',task_id:task.id,worker_id:worker.id,live_status:'busy'})}
  const processRuntime={stopMission:async()=>0,list:()=>[]},state={config:structuredClone(DEFAULT_HI_CONFIG),hostConfig:{},configResolution:undefined,openCodeVersion:'1.18.25'}
  const {toolSurface}=createHiToolSurface({state,store,tasks,processRuntime,projectRoot:process.cwd(),capabilities:detectOpenCodeCapabilities({}),native:{},getModels:()=>[],scopedStores:{contextArtifacts:{}}})
  const out=JSON.parse(await toolSurface.hi_task_await.execute({id:task.id,timeout_ms:1},{sessionID:m.identity.session_id}))
  assert.equal(out.retry_same_await,false);assert.deepEqual(out.recovery,{action:'hi_task_cancel',reason:'bounded-busy-no-progress-stall',task_id:task.id,worker_id:worker.id,retry_same_await:false})
})

test('context artifact tool refuses canonical evidence-shaped kinds',async()=>{
  const {store,m}=localMission('phase6-artifact-evidence-boundary')
  const tasks={awaitTask:async()=>({status:'waiting',terminal:false,changed:false,timed_out:true})},processRuntime={stopMission:async()=>0,list:()=>[]},state={config:structuredClone(DEFAULT_HI_CONFIG),hostConfig:{},configResolution:undefined,openCodeVersion:'1.18.25'}
  const {toolSurface}=createHiToolSurface({state,store,tasks,processRuntime,projectRoot:process.cwd(),capabilities:detectOpenCodeCapabilities({}),native:{},getModels:()=>[],scopedStores:{contextArtifacts:{}}})
  const out=JSON.parse(await toolSurface.hi_context_artifact_add.execute({kind:'review-evidence',summary:'prose copied from a still-running reviewer'},{sessionID:m.identity.session_id}))
  assert.equal(out.status,'BLOCKED');assert.equal(out.reason,'context-artifact-cannot-create-canonical-evidence');assert.equal(out.retry_same_call,false);assert.equal(m.context.context_artifacts.length,0)
})

test('route projection reports no admissible verifier instead of inviting arbitrary rechecks',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-p6-no-route-'))
  try{
    writeFileSync(join(root,'package.json'),JSON.stringify({private:true}))
    const {m}=localMission('phase6-no-route');closeImplementation(m)
    const decision=projectControlDecision(m,root)
    assert.equal(decision.action,'VERIFY');assert.equal(decision.verification_route_status,'none');assert.deepEqual(decision.verification_routes,[])
    for(const action of ['read','hi_readiness','unclassified-bash','redundant-verifier-child'])assert.ok(decision.ineffective_actions.includes(action),action)
    const runtime=buildMissionRuntimeProjection(m,undefined,root)
    assert.match(runtime.next_action,/route=none; no-admissible-repo-native-verifier; report-gap-and-stop/)
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('hi_task_start cannot invent a generic technical verifier when canonical route is none',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-p6-no-route-admission-'))
  try{
    writeFileSync(join(root,'package.json'),JSON.stringify({private:true}))
    const {store,m}=localMission('phase6-no-route-admission');closeImplementation(m)
    let starts=0
    const tasks={start:async()=>{starts++;throw new Error('must not dispatch')},awaitTask:async()=>({status:'waiting',terminal:false,changed:false,timed_out:true})}
    const processRuntime={stopMission:async()=>0,list:()=>[]}
    const state={config:structuredClone(DEFAULT_HI_CONFIG),hostConfig:{},configResolution:undefined,openCodeVersion:'1.18.23'}
    const {toolSurface}=createHiToolSurface({state,store,tasks,processRuntime,projectRoot:root,workingDirectory:root,capabilities:detectOpenCodeCapabilities({}),native:{},getModels:()=>[],scopedStores:{contextArtifacts:{}}})
    const out=JSON.parse(await toolSurface.hi_task_start.execute({objective:'invent a verifier',role:'coder',scope:'phase6.txt',required_evidence:'changed-surface-sanity'},{sessionID:m.identity.session_id}))
    assert.equal(out.status,'BLOCKED');assert.equal(out.reason,'no-admissible-repo-native-verifier');assert.equal(out.retry_same_start,false);assert.equal(starts,0)
    assert.match(out.instruction,/Do not invent a test file, verifier command, or generic verifier child/i)
    assert.ok(m.execution.ledger.some(e=>e.type==='verification.worker-admission-blocked'&&e.payload?.reason==='no-admissible-repo-native-verifier'))
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('route projection exposes only declared admissible repo-native verification scripts',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-p6-route-'))
  try{
    writeFileSync(join(root,'package.json'),JSON.stringify({private:true,scripts:{check:'node scripts/check.mjs'}}))
    const {m}=localMission('phase6-route');closeImplementation(m)
    const decision=projectControlDecision(m,root)
    assert.equal(decision.action,'VERIFY');assert.equal(decision.verification_route_status,'available')
    assert.deepEqual(decision.verification_routes,[{required_kind:'changed-surface-sanity',evidence_kind:'changed-surface-sanity',command:'npm run check',source:'package-script'}])
    assert.equal(decision.ineffective_actions.includes('unclassified-bash'),false)
    const runtime=buildMissionRuntimeProjection(m,undefined,root)
    assert.match(runtime.next_action,/route=npm run check/)
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('repeated semantic context artifact reuses durable identity and one mission handle',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-p6-artifact-reuse-'))
  try{
    const {ContextArtifactStore}=await import('../dist/runtime/context/artifact-store.js')
    const {store,m}=localMission('phase6-artifact-reuse')
    const tasks={awaitTask:async()=>({status:'waiting',terminal:false,changed:false,timed_out:true})}
    const processRuntime={stopMission:async()=>0,list:()=>[]}
    const state={config:structuredClone(DEFAULT_HI_CONFIG),hostConfig:{},configResolution:undefined,openCodeVersion:'1.18.20'}
    const contextArtifacts=new ContextArtifactStore(root)
    const {toolSurface}=createHiToolSurface({state,store,tasks,processRuntime,projectRoot:root,capabilities:detectOpenCodeCapabilities({}),native:{},getModels:()=>[],scopedStores:{contextArtifacts}})
    const args={kind:'research',summary:'bounded finding',content:'same semantic body',source_files:'src/a.ts'}
    const first=JSON.parse(await toolSurface.hi_context_artifact_add.execute(args,{sessionID:m.identity.session_id}))
    const second=JSON.parse(await toolSurface.hi_context_artifact_add.execute(args,{sessionID:m.identity.session_id}))
    assert.equal(first.id,second.id)
    assert.equal(m.context.context_artifacts.length,1)
    assert.equal(m.context.context_artifacts[0].id,first.id)
    assert.equal(m.execution.ledger.filter(e=>e.type==='context-artifact.added').length,1)
    assert.equal(m.execution.ledger.filter(e=>e.type==='context-artifact.reused').length,1)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('terminal CLEANUP_PENDING process projects cleanup-only custody instead of generic work recovery',()=>{
  const {m}=localMission('phase6-terminal-cleanup');closeImplementation(m)
  observeToolAfter(m,'bash',{command:'npm run check'},{stdout:'check passed',metadata:{exit:0}},process.cwd())
  const verify=m.execution.obligations.find(x=>x.id==='o-verification');assert.ok(verify);verify.status='closed';verify.closedAt=Date.now()
  m.execution.processes.push({process_id:'proc-terminal-clean',mission_id:m.identity.mission_id,task_id:'t-service',worker_id:'w-service',host:'opencode',command_identity:'c'.repeat(64),cwd:process.cwd(),pid:4244,status:'TERMINATED',started_at:Date.now()-1000,ended_at:Date.now(),termination_reason:'signal:SIGTERM',output_artifact_refs:[],authority_ref:'native',cleanup_state:'CLEANUP_PENDING'})
  const decision=projectControlDecision(m,process.cwd());assert.equal(decision.action,'CONTINUE');assert.deepEqual(decision.open_obligations,[])
  const runtime=buildMissionRuntimeProjection(m);assert.match(runtime.next_action,/cleanup-terminal-process:proc-terminal-clean/);assert.match(runtime.next_action,/hi_process_cleanup id=proc-terminal-clean/);assert.match(runtime.next_action,/control-plane custody/);assert.doesNotMatch(runtime.next_action,/canonical-open-obligation/)
})
