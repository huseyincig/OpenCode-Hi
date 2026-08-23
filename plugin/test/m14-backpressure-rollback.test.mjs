import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'
import {createRuntimeScopedStores} from '../dist/runtime/application/runtime-scoped-stores.js'
import {ContextArtifactStore} from '../dist/runtime/context/artifact-store.js'
import {WorkspaceRuntime} from '../dist/runtime/workspace/runtime.js'
import {createTask} from '../dist/runtime/worker/worker-runtime.js'
import {validateMissionEnvelope} from '../dist/runtime/mission/validators.js'
import {opencodeChildPort} from './helpers/host-port.mjs'

const hiRoot=fileURLToPath(new URL('../../',import.meta.url)).replace(/[\\/]$/,'')
const BASE='b'.repeat(40)
const host={agent:PACKAGED_HI_AGENTS}
function client(created=[],prompts=[],aborts=[]){let n=0;return{session:{
  create:async()=>{const id=`child-${++n}`;created.push(id);return{data:{id}}},
  promptAsync:async req=>{prompts.push(req);return{data:{}}},
  abort:async req=>{aborts.push(req);return{data:true}},diff:async()=>({data:[]}),
}}}
function mission(root,id='m14-backpressure'){
  const store=new MissionStore(root),m=store.start(id,'bounded queue transaction')
  store.applyInitialSemanticAssessment(id,{material:true,message_kind:'mission',task_kind:'implementation',scope:'multi-stream',risk:'low',ambiguity:'none',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation'],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]})
  m.execution.execution_mode='parallel';m.execution.topology={mode:'multi-agent',parallelism:8,reason:['m14-backpressure-test']}
  return m
}
function runtime(root,{workspaceRuntime,global=1,scoped=createRuntimeScopedStores(root,hiRoot),created=[],prompts=[],aborts=[]}={}){
  const registry=new BackgroundRegistry(),scheduler=createConcurrencyPolicySource(()=>({global,providers:{},models:{}}))
  const rt=new TaskRuntime(opencodeChildPort(client(created,prompts,aborts)),registry,scheduler,root,hiRoot,()=>DEFAULT_HI_CONFIG,()=>[],()=>structuredClone(host),undefined,[],scoped,workspaceRuntime)
  return{rt,registry,scheduler,scoped,created,prompts,aborts}
}
async function fillCapacityAndQueue(rt,m){
  const active=await rt.start(m,{objective:'active-0',role:'coder',category:'quick',scope:['src/active.ts']})
  for(let i=0;i<32;i++){const out=await rt.start(m,{objective:`queued-${i}`,role:'coder',category:'quick',scope:[`src/q-${i}.ts`]});assert.equal(out.readiness,'WAIT')}
  assert.equal(rt.queueDepth(),32)
  return active
}
function addArtifact(scoped,m){
  const a=scoped.contextArtifacts.add('note','queue transaction artifact','payload',[])
  m.context.context_artifacts.push({id:a.artifact_id,kind:'note',uri:`hi-artifact:${a.artifact_id}`,summary:a.summary,sha256:a.content_hash,added_at:Date.now()})
  return a
}
function addTddNeed(m){
  const need={name:'hi-test-driven-development',signal:'intent.tdd',trigger_source:'task-intent',producer:'intent',reason:'queue transaction methodology',created_at:Date.now()}
  m.methodology.methodology_needs.push(need);return need
}
class FakeWorkspaceExecutor{
  constructor({failCleanup=false}={}){this.failCleanup=failCleanup;this.provisions=[];this.cleaned=[]}
  async sourceBaseline(){return BASE}
  async provision(req){this.provisions.push(structuredClone(req));return{host_workspace_id:`ws-${this.provisions.length}`,workspace_path:`/tmp/m14-ws-${this.provisions.length}`}}
  async reintegrate(){return{applied_files:[]}}
  async reconcile(lease){return{disposition:'ADOPTED',lease}}
  async cleanup(lease){this.cleaned.push(lease.lease_id);if(this.failCleanup)throw new Error('synthetic cleanup failure')}
}

test('M14 accepted queued task binds methodology and durable artifact only after queue admission',async()=>{
  const root=mkdtempSync(join(tmpdir(),'m14-queue-bind-'))
  try{
    const m=mission(root,'m14-queue-bind'),x=runtime(root),active=await x.rt.start(m,{objective:'active',role:'coder',category:'quick',scope:['src/a.ts']})
    assert.equal(active.readiness,'READY')
    const need=addTddNeed(m),artifact=addArtifact(x.scoped,m)
    const out=await x.rt.start(m,{objective:'queued-with-bindings',role:'coder',category:'quick',scope:['src/b.ts'],contextArtifactIds:[artifact.artifact_id]})
    assert.equal(out.readiness,'WAIT');assert.ok(out.methodologies.includes('hi-test-driven-development'));assert.equal(need.task_id,out.task_id)
    assert.deepEqual(new ContextArtifactStore(root).get(artifact.artifact_id).consumer_refs,[out.task_id])
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('M14 queue overflow rolls back task worker methodology and artifact side effects atomically',async()=>{
  const root=mkdtempSync(join(tmpdir(),'m14-queue-overflow-'))
  try{
    const m=mission(root,'m14-queue-overflow'),x=runtime(root);await fillCapacityAndQueue(x.rt,m)
    const before={tasks:m.execution.tasks.length,workers:m.execution.workers.length,needs:m.methodology.methodology_needs.length},need=addTddNeed(m),artifact=addArtifact(x.scoped,m),consumersBefore=[...new ContextArtifactStore(root).get(artifact.artifact_id).consumer_refs]
    await assert.rejects(()=>x.rt.start(m,{objective:'overflow-transaction',role:'coder',category:'quick',scope:['src/overflow.ts'],contextArtifactIds:[artifact.artifact_id]}),/bounded dispatch queue is full/)
    assert.equal(m.execution.tasks.length,before.tasks);assert.equal(m.execution.workers.length,before.workers);assert.equal(m.methodology.methodology_needs.length,before.needs+1);assert.equal(need.task_id,undefined)
    assert.deepEqual(new ContextArtifactStore(root).get(artifact.artifact_id).consumer_refs,consumersBefore)
    assert.equal(m.execution.tasks.some(t=>t.objective==='overflow-transaction'),false);assert.equal(validateMissionEnvelope(m),true)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('M14 isolated queue overflow removes cleaned lease and isolation decision before discarding task',async()=>{
  const root=mkdtempSync(join(tmpdir(),'m14-queue-workspace-clean-'))
  try{
    const executor=new FakeWorkspaceExecutor(),workspace=new WorkspaceRuntime(executor,root),m=mission(root,'m14-ws-clean'),x=runtime(root,{workspaceRuntime:workspace});await fillCapacityAndQueue(x.rt,m)
    const beforeTasks=m.execution.tasks.length,beforeWorkers=m.execution.workers.length
    await assert.rejects(()=>x.rt.start(m,{objective:'overflow-isolated-clean',role:'coder',category:'quick',scope:['src/isolated.ts'],isolationRequired:true,isolationReason:'adversarial overflow ownership'}),/bounded dispatch queue is full/)
    assert.equal(executor.provisions.length,1);assert.equal(executor.cleaned.length,1);assert.equal(m.execution.tasks.length,beforeTasks);assert.equal(m.execution.workers.length,beforeWorkers)
    assert.equal(m.execution.workspace_leases.length,0);assert.equal(m.execution.isolation_decisions.length,0);assert.equal(validateMissionEnvelope(m),true)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('M14 isolated queue overflow fails closed with durable blocked ownership when workspace cleanup fails',async()=>{
  const root=mkdtempSync(join(tmpdir(),'m14-queue-workspace-fail-'))
  try{
    const executor=new FakeWorkspaceExecutor({failCleanup:true}),workspace=new WorkspaceRuntime(executor,root),m=mission(root,'m14-ws-fail'),x=runtime(root,{workspaceRuntime:workspace});await fillCapacityAndQueue(x.rt,m)
    await assert.rejects(()=>x.rt.start(m,{objective:'overflow-isolated-fail',role:'coder',category:'quick',scope:['src/isolated.ts'],isolationRequired:true,isolationReason:'adversarial overflow ownership'}),/remains BLOCKED because isolated workspace cleanup failed/)
    const task=m.execution.tasks.find(t=>t.objective==='overflow-isolated-fail'),worker=m.execution.workers.find(w=>w.task_id===task?.id),lease=m.execution.workspace_leases.find(l=>l.task_id===task?.id)
    assert.ok(task&&worker&&lease);assert.equal(task.status,'blocked');assert.equal(task.result?.status,'BLOCKED');assert.equal(worker.status,'failed');assert.equal(lease.status,'ORPHANED');assert.equal(lease.cleanup_state,'QUARANTINED')
    assert.ok(m.execution.blockers.includes(`workspace-orphan:${lease.lease_id}`));assert.ok(m.execution.blockers.includes(`queue-overflow-cleanup-failed:${task.id}`));assert.equal(m.execution.isolation_decisions.some(d=>d.requested_by===`task:${task.id}`),true);assert.equal(validateMissionEnvelope(m),true)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('M14 queued dependency work below the topology ceiling does not block an independently runnable task',async()=>{
  const root=mkdtempSync(join(tmpdir(),'m14-queue-fairness-'))
  try{
    const m=mission(root,'m14-queue-fairness'),x=runtime(root,{global:8}),dependency=createTask(m,{objective:'unresolved external prerequisite',role:'coder',category:'quick',scope:['src/prereq.ts']})
    for(let i=0;i<6;i++){const out=await x.rt.start(m,{objective:`dependency-wait-${i}`,role:'coder',category:'quick',scope:[`src/wait-${i}.ts`],dependencies:[dependency.id]});assert.equal(out.readiness,'WAIT')}
    assert.equal(x.rt.queueDepth(),6);assert.equal(m.execution.scheduler.reservations.length,0)
    const independent=await x.rt.start(m,{objective:'independent-runnable',role:'coder',category:'quick',scope:['src/free.ts']})
    assert.equal(independent.readiness,'READY');assert.equal(x.rt.queueDepth(),6);assert.equal(m.execution.scheduler.reservations.length,1);assert.ok(x.created.length>=1)
  }finally{rmSync(root,{recursive:true,force:true})}
})
