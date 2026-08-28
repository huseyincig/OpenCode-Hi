import test from 'node:test'
import assert from 'node:assert/strict'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {makeChildSessionPort} from './helpers/host-port.mjs'

function setup(){
  let liveStatus='busy',aborts=0,activityRead=0
  const child=makeChildSessionPort({
    status:async()=>liveStatus,
    abort:async()=>{aborts++;return'client'},
  })
  const registry=new BackgroundRegistry()
  const scheduler=createConcurrencyPolicySource(()=>({global:2,providers:{p:2},models:{'p/code':2}}))
  const readAssistantResult=async()=>{
    activityRead++
    return {text:'',activity:{message_id:`msg_activity_${activityRead}`,observed_at:10_000+activityRead,output_tokens:activityRead*10,reasoning_tokens:0,tool_calls:activityRead,text_chars:activityRead*20}}
  }
  const runtime=new TaskRuntime(child,registry,scheduler,process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[{id:'p/code',provider:'p',quality:8,cost:1,tags:['coding']}],()=>({}),undefined,[],undefined,undefined,undefined,undefined,undefined,readAssistantResult)
  const m=startAssessedMission(new MissionStore(),'await-cancel-live','run owned server and verify',{task_kind:'implementation',scope:'local',required_capabilities:['implementation'],likely_verification:[]})
  return{runtime,m,setStatus:value=>{liveStatus=value},aborts:()=>aborts,activityReads:()=>activityRead}
}


test('implicit process-lifecycle support requires a bounded objective and never inherits mission scope',async()=>{
  const {runtime,m}=setup()
  await assert.rejects(()=>runtime.start(m,{role:'coder',processLifecycle:true}),/requires an explicit bounded objective.*cannot inherit the Mission objective/i)
  assert.deepEqual(m.execution.tasks,[]);assert.deepEqual(m.execution.workers,[])
  const started=await runtime.start(m,{objective:'start and keep the inventory HTTP server ready for parent smoke checks',role:'coder',processLifecycle:true})
  const task=m.execution.tasks.find(t=>t.id===started.task_id);assert.ok(task)
  assert.match(task.objective,/runtime process resource\/readiness/i);assert.doesNotMatch(task.objective,/parent smoke checks/i)
  assert.deepEqual(task.scope,[],'resource-only support must not inherit semantic likely-target scope')
  assert.deepEqual(task.obligation_ids,[]);assert.deepEqual(task.requiredEvidence,[]);assert.deepEqual(task.execution_profile.methodologies,[])
})

test('implicit process-lifecycle support without an explicit role uses the neutral runtime resource owner instead of mission routing',async()=>{
  const {runtime,m}=setup()
  m.identity.intent.taskKind='bug-fix';m.identity.intent.scope='multi-file';m.identity.intent.requiredCapabilities=['repository-analysis','implementation','verification']
  const started=await runtime.start(m,{objective:'run inventory server on port 3100 for HTTP smoke testing',processLifecycle:true})
  const task=m.execution.tasks.find(t=>t.id===started.task_id),worker=m.execution.workers.find(w=>w.id===started.worker_id);assert.ok(task&&worker)
  assert.equal(task.role,'coder');assert.equal(worker.role,'coder')
  assert.deepEqual(task.obligation_ids,[]);assert.deepEqual(task.requiredEvidence,[])
  assert.ok(started.selection_reason.includes('implicit-process-support:canonical-runtime-resource-owner'))
  assert.ok(!started.selection_reason.some(reason=>/repository diagnosis owner/i.test(reason)))
})

test('explicit repository-explorer process task keeps explicit specialist ownership',async()=>{
  const {runtime,m}=setup()
  const started=await runtime.start(m,{objective:'inspect repository while keeping a process available if needed',role:'repository-explorer',scope:['src/runtime/task/task-runtime.ts'],processLifecycle:true})
  const task=m.execution.tasks.find(t=>t.id===started.task_id);assert.equal(task.role,'repository-explorer')
})

test('implicit process-lifecycle support task owns only the runtime resource, not mission implementation or verification',async()=>{
  const {runtime,m}=setup()
  const verify=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(verify);m.execution.verification_policy.requiredKinds=['targeted-tests','changed-surface-sanity','visual-check'];verify.requiredEvidence=[...m.execution.verification_policy.requiredKinds]
  const started=await runtime.start(m,{objective:'run and keep server for verification',role:'coder',scope:['app.py'],processLifecycle:true})
  const task=m.execution.tasks.find(t=>t.id===started.task_id);assert.ok(task)
  assert.deepEqual(task.requiredEvidence,[])
  assert.deepEqual(task.obligation_ids,[])
  assert.deepEqual(task.execution_profile.task.required_evidence,[])
  assert.deepEqual(task.execution_profile.verification_policy.requiredKinds,['targeted-tests','changed-surface-sanity','visual-check'],'mission policy remains visible as policy but is not task-owned evidence')
})

test('process-lifecycle task preserves explicit mission evidence and obligation ownership',async()=>{
  const {runtime,m}=setup()
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation'),verification=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(implementation&&verification)
  const started=await runtime.start(m,{objective:'run server and own explicit verification',role:'coder',scope:['app.py'],processLifecycle:true,requiredEvidence:['targeted-tests'],obligationIds:[implementation.id,verification.id]})
  const task=m.execution.tasks.find(t=>t.id===started.task_id);assert.ok(task)
  assert.deepEqual(task.requiredEvidence,['targeted-tests'])
  assert.deepEqual(task.obligation_ids,[implementation.id,verification.id])
})

test('await timeout reconciles exact busy child activity without redefining registry changed semantics',async()=>{
  const {runtime,m}=setup()
  const started=await runtime.start(m,{objective:'run owned server',role:'coder',scope:['app.py'],processLifecycle:true})
  const out=await runtime.awaitTask(m,started.task_id,1)
  assert.equal(out.status,'running')
  assert.equal(out.terminal,false)
  assert.equal(out.changed,false,'registry state did not change')
  assert.equal(out.timed_out,true,'bounded wait may still time out')
  assert.equal(out.live_status,'busy','exact host session remains authoritative')
  assert.equal(out.progress_observed,true,'new child activity across the wait must be surfaced')
  assert.equal(m.execution.ledger.filter(e=>e.type==='assistant.progress-observed').length,2,'pre/post activity observations establish a real delta')
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.await-progress-observed'&&e.worker_id===started.worker_id))
})

test('model-facing cancellation refuses healthy, unreconciled, or unverified active child execution',async()=>{
  const {runtime,m,setStatus,aborts}=setup()
  const started=await runtime.start(m,{objective:'run owned server',role:'coder',scope:['app.py'],processLifecycle:true})
  const busy=await runtime.modelCancelAdmission(m,started.task_id)
  assert.deepEqual({allowed:busy.allowed,reason:busy.reason,live_status:busy.live_status},{allowed:false,reason:'healthy-worker-active',live_status:'busy'})
  assert.equal(aborts(),0,'admission must not abort the healthy child')

  setStatus('idle')
  const idle=await runtime.modelCancelAdmission(m,started.task_id)
  assert.deepEqual({allowed:idle.allowed,reason:idle.reason,live_status:idle.live_status},{allowed:false,reason:'child-result-reconcile-required',live_status:'idle'})
  assert.equal(aborts(),0,'idle-but-unreconciled child result must not be destroyed')

  setStatus('unknown')
  const unknown=await runtime.modelCancelAdmission(m,started.task_id)
  assert.deepEqual({allowed:unknown.allowed,reason:unknown.reason,live_status:unknown.live_status},{allowed:false,reason:'active-worker-liveness-unverified',live_status:'unknown'})
  assert.equal(aborts(),0)
})

test('model-facing cancellation cannot retire an unresolved result owner to create an equivalent replacement task',async()=>{
  const {runtime,m,aborts}=setup()
  const started=await runtime.start(m,{objective:'fix owned file',role:'coder',scope:['app.py']})
  runtime.applyResult(m,started.worker_id,{status:'FIX_REQUIRED',summary:'one correction remains',changed_files:[],scope_expansions:[],evidence:[],open_issues:['fix-one'],needs_context:[]})
  const worker=m.execution.workers.find(w=>w.id===started.worker_id),task=m.execution.tasks.find(t=>t.id===started.task_id)
  assert.equal(worker.status,'ready');assert.equal(task.status,'waiting')
  const blocked=await runtime.modelCancelAdmission(m,started.task_id)
  assert.equal(blocked.allowed,false);assert.equal(blocked.reason,'child-result-reconcile-required');assert.equal(aborts(),0)
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.cancel.admission-blocked'&&e.task_id===started.task_id&&e.payload?.reason==='child-result-reconcile-required'))
  await assert.rejects(()=>runtime.start(m,{objective:'replacement for same obligation',role:'coder',scope:['app.py'],obligationIds:task.obligation_ids}),/Canonical task .* unresolved FIX_REQUIRED/)
  for(const id of task.obligation_ids){const obligation=m.execution.obligations.find(o=>o.id===id);if(obligation)obligation.status='closed'}
  const reconciled=await runtime.modelCancelAdmission(m,started.task_id)
  assert.equal(reconciled.allowed,true);assert.equal(reconciled.reason,'non-running-task')
  assert.equal(await runtime.cancel(m,started.task_id),true);assert.equal(aborts(),1)
})

test('canonical internal stop cancellation still aborts a live busy worker',async()=>{
  const {runtime,m,aborts}=setup()
  const started=await runtime.start(m,{objective:'run owned server',role:'coder',scope:['app.py'],processLifecycle:true})
  assert.equal(m.execution.workers.find(w=>w.id===started.worker_id).status,'busy')
  assert.equal(await runtime.cancelAll(m),1,'internal cancellation remains destructive when canonical runtime owns STOP')
  assert.equal(aborts(),1)
  assert.equal(m.execution.workers.find(w=>w.id===started.worker_id).status,'cancelled')
})
