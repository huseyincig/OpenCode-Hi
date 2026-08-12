import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { ConcurrencyScheduler } from '../dist/runtime/scheduler/concurrency.js'
import { resolveHhcConfig } from '../dist/config/resolver.js'
import { PACKAGED_HHC_AGENTS } from '../dist/generated/agent-config.js'
import { evaluateTaskPreconditions } from '../dist/runtime/readiness/preconditions.js'
import { createTask } from '../dist/runtime/worker/worker-runtime.js'

function runtime(client,hostConfig={agent:structuredClone(PACKAGED_HHC_AGENTS)}){
  return new TaskRuntime(client,new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:8})),process.cwd(),process.cwd(),()=>resolveHhcConfig({}),()=>[],()=>hostConfig)
}
function nativeClient(){
  const creates=[],prompts=[];let n=0
  return {creates,prompts,client:{session:{
    create:async req=>{creates.push(req);return{data:{id:`child-${++n}`}}},
    promptAsync:async req=>{prompts.push(req)},
    abort:async()=>{},
    diff:async()=>({data:[]}),
  }}}
}

test('real native specialist delegation starts explorer, architect and security reviewer as bounded OpenCode children',async()=>{
  for(const role of ['repository-explorer','architect','security-reviewer']){
    const {client,creates,prompts}=nativeClient(),store=new MissionStore(),m=store.start(`specialist-${role}`,`delegate ${role}`)
    const out=await runtime(client).start(m,{role,objective:`bounded ${role} task`,requiredEvidence:[]})
    assert.ok(out.session_id)
    assert.equal(creates.length,1)
    assert.equal(creates[0].body.parentID,m.session_id)
    assert.equal(creates[0].body.agent,role)
    assert.equal(prompts.length,1)
    assert.deepEqual(prompts[0].path,{id:out.session_id})
    assert.equal(prompts[0].body.agent,role)
    assert.equal(m.workers[0].role,role)
    assert.equal(m.workers[0].parent_mission_id,m.mission_id)
    assert.equal(m.ledger.find(e=>e.type==='task.preflight')?.payload?.decision,'READY')
  }
})

test('preflight RESOLVE blocks coder before spawn when effective native agent permissions deny edit',async()=>{
  const {client,creates,prompts}=nativeClient(),store=new MissionStore(),m=store.start('deny-edit','implement parser fix')
  const agents=structuredClone(PACKAGED_HHC_AGENTS);agents.coder.permission.edit='deny'
  await assert.rejects(()=>runtime(client,{agent:agents}).start(m,{role:'coder',objective:'implement parser fix'}),/RESOLVE: coder cannot implement because effective OpenCode edit permission is denied/)
  assert.equal(creates.length,0);assert.equal(prompts.length,0);assert.equal(m.tasks.length,0);assert.equal(m.workers.length,0)
  assert.equal(m.ledger.find(e=>e.type==='task.preflight')?.payload?.decision,'RESOLVE')
})

test('preflight RESOLVE prevents specialist recursion when colliding host agent allows task delegation',async()=>{
  const {client,creates}=nativeClient(),store=new MissionStore(),m=store.start('recursive-agent','inspect architecture')
  const agents=structuredClone(PACKAGED_HHC_AGENTS);agents.architect.permission.task='allow'
  await assert.rejects(()=>runtime(client,{agent:agents}).start(m,{role:'architect',objective:'inspect architecture'}),/RESOLVE: architect may recursively delegate via task/)
  assert.equal(creates.length,0)
})

test('contract-critical ambiguity blocks implementation but permits repository exploration to resolve it',async()=>{
  const {client,creates}=nativeClient(),store=new MissionStore(),m=store.start('ambiguity-preflight','change auth contract')
  m.intent.ambiguity='contract-critical'
  await assert.rejects(()=>runtime(client).start(m,{role:'coder',objective:'implement ambiguous auth contract'}),/contract-critical ambiguity/i)
  assert.equal(creates.length,0)
  const out=await runtime(client).start(m,{role:'repository-explorer',objective:'resolve auth contract from repository evidence',requiredEvidence:[]})
  assert.ok(out.session_id);assert.equal(creates.length,1);assert.equal(creates[0].body.agent,'repository-explorer')
})

test('incomplete prerequisite is WAIT and queues without native child spawn',async()=>{
  const {client,creates}=nativeClient(),store=new MissionStore(),m=store.start('dependency-wait-preflight','analyze after prerequisite')
  m.execution_mode='parallel'
  const prereq=createTask(m,{objective:'prerequisite',role:'repository-explorer',category:'quick'});prereq.status='running'
  const out=await runtime(client).start(m,{role:'architect',objective:'dependent design',dependencies:[prereq.id],requiredEvidence:[]})
  assert.equal(out.session_id,undefined);assert.equal(creates.length,0)
  assert.match(out.selection_reason.join('|'),/queued:runtime-capacity-or-prerequisite/)
  const preflight=m.ledger.filter(e=>e.type==='task.preflight').at(-1)
  assert.equal(preflight?.payload?.decision,'WAIT')
})

test('missing native worker capability is RESOLVE before creating task or trying model fallbacks',async()=>{
  const client={session:{promptAsync:async()=>{throw new Error('must not prompt')}}},store=new MissionStore(),m=store.start('native-missing','explore repo')
  await assert.rejects(()=>runtime(client).start(m,{role:'repository-explorer',objective:'explore repo'}),/session\.create is unavailable/)
  assert.equal(m.tasks.length,0);assert.equal(m.workers.length,0)
})

test('task precondition vocabulary includes USER_ACTION_REQUIRED for real authority-before-start boundaries',()=>{
  const result=evaluateTaskPreconditions({role:'coder',implementation:true,dependencies:{unknown:[],failed:[],incomplete:[]},modelAvailable:true,native:{childSession:true,prompt:true},authorityRequired:true})
  assert.equal(result.decision,'USER_ACTION_REQUIRED')
  assert.ok(result.items.some(x=>x.id==='user-authority'))
})
