import test from 'node:test'
import assert from 'node:assert/strict'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { createConcurrencyPolicySource } from '../dist/runtime/scheduler/concurrency.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import { resolveHiConfig } from '../dist/config/resolver.js'
import {opencodeChildPort} from './helpers/host-port.mjs'
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

function baseClient(created=[],prompts=[]){
  let n=0
  return {session:{
    create:async req=>{const id=`child-${++n}`;created.push({id,req});return {data:{id}}},
    promptAsync:async req=>{prompts.push(req);return {data:{}}},
    abort:async()=>({data:true}),diff:async()=>({data:[]}),
  }}
}

test('selected native model variant must be evidenced by assistant runtime metadata',()=>{
  const runtime=new TaskRuntime(opencodeChildPort({}),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>({}))
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'s','opaque deep task')
  m.execution.tasks.push({id:'t',objective:'x',status:'running',role:'coder',category:'deep',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],worker_id:'w',created_at:Date.now(),updated_at:Date.now()})
  m.execution.workers.push({id:'w',task_id:'t',role:'coder',category:'deep',parent_session_id:'s',parent_mission_id:m.identity.mission_id,model:'p/deep',model_variant:'high',fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'busy',generation_at_spawn:m.continuation.generation})
  let r=runtime.noteEffectiveModel(m,'w',{model:'p/deep',variant:'medium',source:'assistant-message-metadata'})
  assert.equal(r.ok,false)
  assert.equal(m.execution.workers[0].effective_model_verified,true)
  assert.equal(m.execution.workers[0].effective_model_variant_verified,false)
  assert.ok(r.reason.startsWith('model-variant-mismatch:'))
  r=runtime.noteEffectiveModel(m,'w',{model:'p/deep',variant:'high',source:'assistant-message-metadata'})
  assert.equal(r.ok,true)
  assert.equal(m.execution.workers[0].effective_model_variant_verified,true)
  assert.ok(m.execution.ledger.some(e=>e.type==='model.effective.verified'&&e.payload?.variant_verified===true))
})

test('missing runtime variant evidence blocks a variant-constrained child',()=>{
  const runtime=new TaskRuntime(opencodeChildPort({}),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>({}))
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'s','opaque deep task')
  m.execution.tasks.push({id:'t',objective:'x',status:'running',role:'coder',category:'deep',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],worker_id:'w',created_at:Date.now(),updated_at:Date.now()})
  m.execution.workers.push({id:'w',task_id:'t',role:'coder',category:'deep',parent_session_id:'s',parent_mission_id:m.identity.mission_id,model:'p/deep',model_variant:'high',fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'busy',generation_at_spawn:m.continuation.generation})
  const r=runtime.noteEffectiveModel(m,'w',{model:'p/deep',source:'assistant-message-metadata'})
  assert.equal(r.ok,false)
  assert.ok(r.reason.startsWith('model-variant-unverified:'))
})

test('fallback reason persists on worker lifecycle for dispatch and runtime fallback',async()=>{
  const created=[],prompts=[]
  const client=baseClient(created,prompts)
  const cfg=resolveHiConfig({routing:{roleModels:{coder:['p/primary','p/fallback']},maxFallbacks:2}})
  const models=[{id:'p/primary',provider:'p',writeCapable:true,tags:['balanced'],variants:['medium']},{id:'p/fallback',provider:'p',writeCapable:true,tags:['balanced'],variants:['low']}]
  let failPrimary=true
  client.session.create=async req=>{const model=req.body?.model?.id;if(model==='primary'&&failPrimary){failPrimary=false;throw new Error('provider unavailable')}const id='child-fallback';created.push({id,req});return {data:{id}}}
  const runtime=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:3,providers:{p:3},models:{}})),process.cwd(),process.cwd(),()=>cfg,()=>models,()=>({}))
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'s','opaque implementation')
  const out=await runtime.start(m,{objective:'implement fix',role:'coder',category:'standard',scope:['src/fix.ts']})
  const w=m.execution.workers.find(x=>x.id===out.worker_id)
  const t=m.execution.tasks.find(x=>x.id===out.task_id)
  assert.equal(w.model,'p/fallback')
  assert.equal(w.model_variant,'low')
  assert.equal(w.projected_model,'p/fallback')
  assert.equal(w.projected_model_variant,'low')
  assert.equal(w.fallback_history.length,1)
  assert.equal(w.fallback_history[0].phase,'dispatch')
  assert.match(w.fallback_history[0].reason,/explicit role-mapping order/)
  assert.ok(t.execution_profile.fallback_reasons.some(x=>x.model==='p/fallback'))

  // Re-arm the same worker with a primary->fallback runtime chain and prove the reason survives.
  w.model='p/primary';w.model_variant='medium';w.fallbacks=['p/fallback'];w.session_id='child-fallback';w.status='busy';w.fallback_history=[]
  assert.equal((await runtime.settleHostIdleRuntimeError(m,w,{name:'APIError',message:'429 provider rate limit',isRetryable:true,statusCode:429})).wakeResult,'RUNTIME_FALLBACK')
  assert.equal(w.model,'p/fallback')
  assert.equal(w.projected_model,'p/fallback')
  assert.equal(w.projected_model_variant,'low')
  assert.equal(w.fallback_history.length,1)
  assert.equal(w.fallback_history[0].phase,'runtime')
  assert.match(w.fallback_history[0].reason,/failure=provider-transport/)
})

test('role-specific children respect model capacity and second worker remains queued until slot releases',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-model-capacity-'))
  mkdirSync(join(root,'src/runtime/task'),{recursive:true});writeFileSync(join(root,'src/runtime/task/task-runtime.ts'),'export const fixture=1\n');writeFileSync(join(root,'src/b.ts'),'export const fixtureB=1\n')
  try{
    const created=[],prompts=[],client=baseClient(created,prompts)
    const cfg=resolveHiConfig({routing:{roleModels:{'repository-explorer':['p/shared'],architect:['p/shared']}}})
    const models=[{id:'p/shared',provider:'p',writeCapable:true,tags:['balanced']}]
    const scheduler=createConcurrencyPolicySource(()=>({global:3,providers:{p:3},models:{'p/shared':1}}))
    const runtime=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),scheduler,root,root,()=>cfg,()=>models,()=>({}))
    const store=new MissionStore(root),m=startAssessedMission(store,'s','opaque parallel inspection',{task_kind:'review',required_capabilities:['repository-analysis']});m.execution.execution_mode='parallel'
    const a=await runtime.start(m,{objective:'inspect alpha',role:'repository-explorer',category:'standard',scope:['src/runtime/task/task-runtime.ts']})
    assert.equal(a.readiness,'READY');assert.equal(m.execution.scheduler.reservations.length,1)
    const b=await runtime.start(m,{objective:'inspect beta',role:'architect',category:'standard',scope:['src/b.ts']})
    assert.equal(b.readiness,'WAIT')
    assert.equal(runtime.queueDepth(),1)
    assert.equal(created.length,1)
    runtime.applyResult(m,a.worker_id,{status:'DONE',summary:'alpha done',changed_files:[],evidence:[],open_issues:[],needs_context:[]})
    await new Promise(r=>setTimeout(r,20))
    assert.equal(created.length,2)
    const wb=m.execution.workers.find(w=>w.id===b.worker_id)
    assert.equal(wb.status,'busy')
    assert.equal(wb.model,'p/shared')
    assert.equal(m.execution.scheduler.reservations.length,1)
  } finally { rmSync(root,{recursive:true,force:true}) }
})
