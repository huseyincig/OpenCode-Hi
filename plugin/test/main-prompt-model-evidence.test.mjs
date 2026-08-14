import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveModel } from '../dist/runtime/routing/model-resolver.js'
import { resolveHiConfig } from '../dist/config/resolver.js'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { ConcurrencyScheduler } from '../dist/runtime/scheduler/concurrency.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import HiPlugin from '../dist/plugin.js'
import { startAssessedMission, assessPluginMission } from './helpers/semantic.mjs'

const inventory=[
  {id:'p/live',provider:'p',writeCapable:true,tags:['balanced']},
  {id:'p/other',provider:'p',writeCapable:true,tags:['reasoning']},
]

test('role primary missing does not claim recommended fast path; configured live fallback remains eligible',()=>{
  const cfg=resolveHiConfig({routing:{roleModels:{coder:['p/missing','p/live']}}})
  const r=resolveModel('standard',inventory,cfg,undefined,'coder',{})
  assert.equal(r.primary,'p/live')
  assert.ok(r.reason.some(x=>x.includes('role-primary-unavailable-or-policy-rejected:p/missing')))
  assert.ok(!r.reason.some(x=>x.includes('recommended-fast-path')))
})

test('dispatch revalidates provider policy and skips a provider denied after initial role resolution',async()=>{
  const created=[];let hostReads=0
  const inv=[{id:'p/live',provider:'p',writeCapable:true,tags:['balanced']},{id:'q/other',provider:'q',writeCapable:true,tags:['balanced']}]
  const client={session:{
    create:async req=>{created.push(req);return {data:{id:'child-policy'}}},
    promptAsync:async()=>({data:{}}),abort:async()=>({data:{}}),diff:async()=>({data:[]}),
  }}
  const cfg=resolveHiConfig({routing:{roleModels:{coder:['p/live','q/other']}}})
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'s','opaque implementation')
  const runtime=new TaskRuntime(client,new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:3,providers:{},models:{}})),process.cwd(),process.cwd(),()=>cfg,()=>inv,()=>{hostReads++;return hostReads===1?{}:{disabled_providers:['p']}})
  const out=await runtime.start(m,{objective:'implement fix',role:'coder',category:'standard'})
  assert.equal(out.model,'q/other')
  assert.equal(created.length,1)
  assert.equal(created[0].body.model.providerID,'q')
  assert.equal(created[0].body.model.id,'other')
})

test('runtime provider fallback revalidates current model policy before sending the fallback prompt',async()=>{
  const calls=[]
  let cfg=resolveHiConfig({})
  const client={session:{promptAsync:async req=>{calls.push(req)},abort:async()=>{},create:async()=>({data:{id:'recovery-child'}}),diff:async()=>({data:[]})}}
  const runtime=new TaskRuntime(client,new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:3,providers:{},models:{}})),process.cwd(),process.cwd(),()=>cfg,()=>[{id:'p/f1',provider:'p'},{id:'q/f2',provider:'q'}],()=>({}))
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'s','opaque fallback task')
  m.execution.tasks.push({id:'t',objective:'x',status:'running',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],worker_id:'w',created_at:Date.now(),updated_at:Date.now()})
  m.execution.workers.push({id:'w',task_id:'t',role:'coder',category:'standard',session_id:'child',parent_session_id:'s',parent_mission_id:m.identity.mission_id,model:'p/primary',fallbacks:['p/f1','q/f2'],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'busy',generation_at_spawn:m.continuation.generation})
  cfg=resolveHiConfig({routing:{allowedProviders:['q']}})
  assert.equal(await runtime.recoverRuntimeFailure(m,'w','429 provider rate limit'),true)
  assert.equal(m.execution.workers[0].model,'q/f2')
  assert.equal(m.execution.workers[0].session_id,'recovery-child')
  assert.deepEqual(m.execution.workers[0].loaded_methodologies,[])
  assert.equal(calls.length,1)
  assert.equal(calls[0].body.model.providerID,'q')
})

async function pluginScenario(observedModel,includeModelMetadata=true){
  const dir=mkdtempSync(join(tmpdir(),'hi-effective-model-'))
  const result={status:'DONE',summary:'done',changed_files:[],evidence:[],open_issues:[],needs_context:[]}
  const client={app:{log:async()=>{}},provider:{list:async()=>({data:[{id:'p',models:[{id:'expected',write:true},{id:'other',write:true}]}]})},session:{
    create:async()=>({data:{id:'child-model'}}),promptAsync:async()=>({data:{}}),abort:async()=>({data:{}}),diff:async()=>({data:[]}),
    messages:async()=>({data:[{info:{id:'msg1',role:'assistant',...(includeModelMetadata?{providerID:'p',modelID:observedModel}:{})},parts:[{type:'text',text:JSON.stringify(result)}]}]}),
  }}
  const hooks=await HiPlugin({directory:dir,worktree:dir,project:{},client});await hooks.config({});await hooks['chat.message']({sessionID:'parent',message:{role:'user',parts:[{type:'text',text:'fix it'}]}},{parts:[]});await assessPluginMission(hooks,'parent')
  const started=JSON.parse(await hooks.tool.hi_task_start.execute({objective:'implementation',role:'coder',category:'standard',model:'p/expected'},{sessionID:'parent'}))
  await hooks.event({event:{type:'session.idle',properties:{sessionID:'child-model'}}})
  const state=JSON.parse(await hooks.tool.hi_task_peek.execute({id:started.task_id},{sessionID:'parent'}))
  const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:80},{sessionID:'parent'}))
  await hooks.dispose?.();rmSync(dir,{recursive:true,force:true});return{state,ledger}
}

test('child assistant message metadata proves the effective model used by the native session',async()=>{
  const {state,ledger}=await pluginScenario('expected')
  assert.equal(state.worker.requested_model,'p/expected')
  assert.equal(state.worker.model,'p/expected')
  assert.equal(state.worker.projected_model,'p/expected')
  assert.equal(state.worker.effective_model,'p/expected')
  assert.equal(state.worker.effective_model_verified,true)
  assert.ok(ledger.events.some(e=>e.type==='model.effective.verified'))
})

test('effective model mismatch blocks DONE and preserves the obligation for reconciliation',async()=>{
  const {state,ledger}=await pluginScenario('other')
  assert.equal(state.worker.effective_model,'p/other')
  assert.equal(state.worker.effective_model_verified,false)
  assert.equal(state.task.result.status,'BLOCKED')
  assert.ok(state.task.result.open_issues.some(x=>x.startsWith('model-effective-mismatch:')))
  assert.ok(ledger.events.some(e=>e.type==='model.effective.mismatch'))
})


test('missing assistant model metadata cannot prove a role-specific child model and therefore blocks DONE',async()=>{
  const {state,ledger}=await pluginScenario('expected',false)
  assert.equal(state.worker.effective_model_verified,false)
  assert.equal(state.task.result.status,'BLOCKED')
  assert.ok(state.task.result.open_issues.some(x=>x.startsWith('model-effective-unverified:')))
  assert.ok(ledger.events.some(e=>e.type==='model.effective.unverified'))
})


test('pre-assistant child idle is ignored until native assistant model evidence exists',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hi-pre-assistant-idle-'))
  const result={status:'DONE',summary:'done',changed_files:[],evidence:[],open_issues:[],needs_context:[]}
  let messageReads=0
  const client={app:{log:async()=>{}},provider:{list:async()=>({data:[{id:'p',models:[{id:'expected',write:true}]}]})},session:{
    create:async()=>({data:{id:'child-race'}}),promptAsync:async()=>({data:{}}),abort:async()=>({data:{}}),diff:async()=>({data:[]}),
    messages:async()=>({data:++messageReads===1
      ?[{info:{id:'u1',role:'user'},parts:[{type:'text',text:'handoff'}]}]
      :[{info:{id:'u1',role:'user'},parts:[{type:'text',text:'handoff'}]},{info:{id:'a1',role:'assistant',providerID:'p',modelID:'expected'},parts:[{type:'text',text:JSON.stringify(result)}]}]}),
  }}
  const hooks=await HiPlugin({directory:dir,worktree:dir,project:{},client});await hooks.config({});await hooks['chat.message']({sessionID:'parent-race',message:{role:'user',parts:[{type:'text',text:'fix it'}]}},{parts:[]});await assessPluginMission(hooks,'parent-race')
  const started=JSON.parse(await hooks.tool.hi_task_start.execute({objective:'implementation',role:'coder',category:'standard',model:'p/expected'},{sessionID:'parent-race'}))
  await hooks.event({event:{type:'session.idle',properties:{sessionID:'child-race'}}})
  const first=JSON.parse(await hooks.tool.hi_task_peek.execute({id:started.task_id},{sessionID:'parent-race'}))
  const firstLedger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:80},{sessionID:'parent-race'}))
  assert.equal(first.worker.status,'busy')
  assert.equal(first.task.result,undefined)
  assert.ok(!firstLedger.events.some(e=>e.type==='model.effective.unverified'))
  assert.ok(firstLedger.events.some(e=>e.type==='worker.idle.pre-assistant-ignored'))
  await hooks.event({event:{type:'session.idle',properties:{sessionID:'child-race'}}})
  const second=JSON.parse(await hooks.tool.hi_task_peek.execute({id:started.task_id},{sessionID:'parent-race'}))
  assert.equal(second.worker.effective_model,'p/expected')
  assert.equal(second.worker.effective_model_verified,true)
  assert.equal(second.task.result.status,'DONE')
  await hooks.dispose?.();rmSync(dir,{recursive:true,force:true})
})


test('projected model mismatch is a first-class blocker even when observed model matches selection',()=>{
  const runtime=new TaskRuntime({},new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>({}))
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'projection-mismatch','opaque task')
  m.execution.tasks.push({id:'t',mission_id:m.identity.mission_id,objective:'x',status:'running',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],external_action_requirements:[],worker_id:'w',created_at:Date.now(),updated_at:Date.now()})
  m.execution.workers.push({id:'w',task_id:'t',role:'coder',category:'standard',parent_session_id:'s',parent_mission_id:m.identity.mission_id,requested_model:'p/expected',model:'p/expected',projected_model:'p/wrong',fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'busy',attempt:1,generation_at_spawn:m.continuation.generation,updated_at:Date.now()})
  const out=runtime.noteEffectiveModel(m,'w',{model:'p/expected',source:'assistant-message-metadata'})
  assert.equal(out.ok,false)
  assert.match(out.reason,/^model-projection-mismatch:/)
  assert.equal(m.execution.workers[0].effective_model_verified,false)
  assert.ok(m.execution.ledger.some(e=>e.type==='model.projection.mismatch'))
})
