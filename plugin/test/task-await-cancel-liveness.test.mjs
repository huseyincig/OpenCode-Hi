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

test('retained non-running task cancellation remains allowed after result reconciliation',async()=>{
  const {runtime,m,aborts}=setup()
  const started=await runtime.start(m,{objective:'fix owned file',role:'coder',scope:['app.py']})
  runtime.applyResult(m,started.worker_id,{status:'FIX_REQUIRED',summary:'one correction remains',changed_files:[],scope_expansions:[],evidence:[],open_issues:['fix-one'],needs_context:[]})
  const worker=m.execution.workers.find(w=>w.id===started.worker_id),task=m.execution.tasks.find(t=>t.id===started.task_id)
  assert.equal(worker.status,'ready');assert.equal(task.status,'waiting')
  const admission=await runtime.modelCancelAdmission(m,started.task_id)
  assert.equal(admission.allowed,true);assert.equal(admission.reason,'non-running-task')
  assert.equal(await runtime.cancel(m,started.task_id),true)
  assert.equal(aborts(),1);assert.equal(worker.status,'cancelled');assert.equal(task.status,'cancelled')
})

test('canonical internal stop cancellation still aborts a live busy worker',async()=>{
  const {runtime,m,aborts}=setup()
  const started=await runtime.start(m,{objective:'run owned server',role:'coder',scope:['app.py'],processLifecycle:true})
  assert.equal(m.execution.workers.find(w=>w.id===started.worker_id).status,'busy')
  assert.equal(await runtime.cancelAll(m),1,'internal cancellation remains destructive when canonical runtime owns STOP')
  assert.equal(aborts(),1)
  assert.equal(m.execution.workers.find(w=>w.id===started.worker_id).status,'cancelled')
})
