import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {RuntimeEventController} from '../dist/runtime/application/runtime-event-controller.js'
import {normalizeOpenCodeEvent} from '../dist/opencode/event-adapter.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {addEvidence,markMutation} from '../dist/runtime/evidence/evidence-runtime.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {opencodeChildPort} from './helpers/host-port.mjs'

const done=summary=>({status:'DONE',summary,changed_files:[],evidence:[],open_issues:[],needs_context:[]})
function bareRuntime(global=2){return new TaskRuntime(opencodeChildPort({}),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))}
function nativeRuntime(global=1){let n=0;const starts=[];const client={session:{create:async()=>({data:{id:`child-${++n}`}}),promptAsync:async req=>{starts.push(req)},diff:async()=>({data:[]}),abort:async()=>({data:true})}};const rt=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global,providers:{p:global},models:{'p/code':global}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[{id:'p/code',provider:'p',quality:8,cost:1,tags:['coding','balanced']}],()=>({}));return{rt,starts}}

test('PROMPT B cancellation wins over a late different worker result and terminal state cannot resurrect',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'race-cancel','cancel race'),rt=bareRuntime()
  const task=createTask(m,{objective:'race task',role:'coder',category:'quick'}),worker=createWorker(m,task,'host-default');worker.status='busy';task.status='running'
  assert.equal(await rt.cancel(m,worker.id),true);assert.equal(worker.status,'cancelled');assert.equal(task.status,'cancelled')
  rt.applyResult(m,worker.id,done('late success'))
  assert.equal(worker.status,'cancelled');assert.equal(task.status,'cancelled');assert.equal(task.result,undefined)
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.result.terminal-ignored'&&e.worker_id===worker.id))
})

test('PROMPT B simultaneous distinct task completions reconcile without double-closing or losing shared obligation state',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'race-complete','parallel completion'),rt=bareRuntime();m.execution.execution_mode='parallel';m.execution.topology={mode:'multi-agent',parallelism:2,reason:['test']}
  const obligation=m.execution.obligations.find(o=>o.kind==='implementation');assert.ok(obligation)
  const a=createTask(m,{objective:'a',role:'coder',category:'quick',scope:['a'],obligationIds:[obligation.id]}),b=createTask(m,{objective:'b',role:'coder',category:'quick',scope:['b'],obligationIds:[obligation.id]})
  const wa=createWorker(m,a,'host-default'),wb=createWorker(m,b,'host-default');for(const [t,w] of [[a,wa],[b,wb]]){t.status='running';w.status='busy'}
  await Promise.all([Promise.resolve().then(()=>rt.applyResult(m,wa.id,done('a done'))),Promise.resolve().then(()=>rt.applyResult(m,wb.id,done('b done')))])
  assert.equal(a.status,'completed');assert.equal(b.status,'completed');assert.equal(obligation.status,'closed')
  assert.equal(m.execution.ledger.filter(e=>e.type==='obligation.closed'&&e.payload?.obligation===obligation.id).length,1)
})

test('PROMPT B evidence/mutation race ordering is deterministic: later mutation invalidates proof and later proof can become fresh',async()=>{
  const store=new MissionStore(),a=startAssessedMission(store,'race-evidence-a','evidence race a')
  await Promise.all([Promise.resolve().then(()=>addEvidence(a,{kind:'targeted-tests',summary:'pass-before-write',scope:['a'],source:'test',outcome:'passed',pass:true})),Promise.resolve().then(()=>markMutation(a,['a'],'concurrent-write'))])
  assert.equal(a.execution.evidence.fresh,false);assert.ok(a.execution.evidence.items[0].invalidated_at)
  const b=startAssessedMission(store,'race-evidence-b','evidence race b')
  await Promise.all([Promise.resolve().then(()=>markMutation(b,['b'],'concurrent-write')),Promise.resolve().then(()=>addEvidence(b,{kind:'targeted-tests',summary:'pass-after-write',scope:['b'],source:'test',outcome:'passed',pass:true}))])
  assert.equal(b.execution.evidence.fresh,true);assert.equal(b.execution.evidence.items.at(-1).invalidated_at,undefined)
})

test('PROMPT B permission reply-before-ask reorder cannot create a phantom pending permission',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'race-perm','permission race'),pending=new Map()
  const services={store,background:{},persistence:{save:()=>{}},tasks:{resolveChildCallback:()=>undefined},teams:{expireMission:async()=>{},reconcileMission:async()=>{}},processRuntime:{},eventSink:()=>{},scopedStores:{}}
  const controller=new RuntimeEventController({state:{config:DEFAULT_HI_CONFIG},host:{refreshRuntimeInventory:async()=>{},log:async()=>{},client:{}},services,projectAuthority:{grant:()=>{}},pendingNativePermissions:pending,projectRoot:process.cwd()})
  await controller.handle(normalizeOpenCodeEvent({type:'permission.replied',properties:{id:'perm-race',sessionID:m.identity.session_id,decision:'once'}}))
  await controller.handle(normalizeOpenCodeEvent({type:'permission.asked',properties:{id:'perm-race',sessionID:m.identity.session_id,permission:'bash'}}))
  assert.equal(m.authority.pending_permissions,0);assert.deepEqual(m.authority.pending_permission_ids,[]);assert.equal(pending.has('perm-race'),false)
  assert.ok(m.execution.ledger.some(e=>e.type==='permission.stale-ask-ignored'&&e.payload?.permission_id==='perm-race'))
})

test('PROMPT B bounded task queue is FIFO among runnable workers and later entries are not starved',async()=>{
  const {rt}=nativeRuntime(1),store=new MissionStore(),m=startAssessedMission(store,'race-queue','queue fairness',{scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation']});m.execution.execution_mode='parallel';m.execution.topology={mode:'multi-agent',parallelism:3,reason:['test']}
  const first=await rt.start(m,{objective:'first',role:'coder',scope:['a.ts']}),second=await rt.start(m,{objective:'second',role:'coder',scope:['b.ts']}),third=await rt.start(m,{objective:'third',role:'coder',scope:['c.ts']})
  assert.equal(rt.queueDepth(),2);assert.equal(m.execution.workers.find(w=>w.id===second.worker_id).status,'queued');assert.equal(m.execution.workers.find(w=>w.id===third.worker_id).status,'queued')
  rt.applyResult(m,first.worker_id,done('first done'));await new Promise(r=>setImmediate(r))
  assert.equal(m.execution.workers.find(w=>w.id===second.worker_id).status,'busy');assert.equal(m.execution.workers.find(w=>w.id===third.worker_id).status,'queued')
  rt.applyResult(m,second.worker_id,done('second done'));await new Promise(r=>setImmediate(r))
  assert.equal(m.execution.workers.find(w=>w.id===third.worker_id).status,'busy');assert.equal(rt.queueDepth(),0)
})


test('late native permission events after STOP cannot retain patterns or persist project authority',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'stopped-permission-owner','permission stop fence'),pending=new Map(),grants=[]
  m.identity.status='stopped';m.continuation.user_interrupted=true
  const services={store,background:{},persistence:{save:()=>{}},tasks:{resolveChildCallback:()=>undefined},teams:{expireMission:async()=>{},reconcileMission:async()=>{}},processRuntime:{},eventSink:()=>{},scopedStores:{}}
  const controller=new RuntimeEventController({state:{config:DEFAULT_HI_CONFIG},host:{refreshRuntimeInventory:async()=>{},log:async()=>{},client:{}},services,projectAuthority:{grant:cls=>grants.push(cls)},pendingNativePermissions:pending,projectRoot:process.cwd()})
  await controller.handle(normalizeOpenCodeEvent({type:'permission.asked',properties:{id:'perm-after-stop',sessionID:m.identity.session_id,patterns:['git push origin *']}}))
  assert.equal(pending.has('perm-after-stop'),false,'STOP must fence process-local permission pattern retention')
  await controller.handle(normalizeOpenCodeEvent({type:'permission.replied',properties:{id:'perm-after-stop',sessionID:m.identity.session_id,response:'always'}}))
  assert.deepEqual(grants,[],'late native always reply after STOP must not persist Hi project authority')
})
