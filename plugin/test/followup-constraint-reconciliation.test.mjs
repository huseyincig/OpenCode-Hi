import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { createChatMessageHook, classifyFollowup } from '../dist/hooks/chat-message.js'
import { createSystemTransformHook } from '../dist/hooks/system-transform.js'
import { createTask, createWorker } from '../dist/runtime/worker/worker-runtime.js'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { ConcurrencyScheduler } from '../dist/runtime/scheduler/concurrency.js'
import { resolveHhcConfig } from '../dist/config/resolver.js'

function callHook(hook, sessionID, userText, assistantText='') {
  return hook(
    { sessionID, message: { role: 'user', parts: [{ type: 'text', text: userText }] } },
    { parts: [{ type: 'text', text: assistantText }] },
  )
}

test('follow-up classifier distinguishes verification and restrictive constraints', () => {
  assert.equal(classifyFollowup('testleri de yap'), 'verification')
  assert.equal(classifyFollowup('yok o dosyaya dokunma'), 'constraint')
  assert.equal(classifyFollowup("don't touch src/auth.ts"), 'constraint')
  assert.equal(classifyFollowup('ayrıca README metnini güncelle'), 'amend')
})

test('human-like follow-up: "testleri de yap" updates current verification contract, not a new implementation obligation', async () => {
  const store = new MissionStore()
  const hook = createChatMessageHook(store)
  const m = store.start('verify-followup', 'login bugını düzelt')
  const missionID = m.mission_id
  const implementationBefore = m.obligations.filter(o => o.kind === 'implementation').length
  await callHook(hook, 'verify-followup', 'testleri de yap')
  assert.equal(m.mission_id, missionID, 'must remain the same mission')
  assert.equal(m.obligations.filter(o => o.kind === 'implementation').length, implementationBefore, 'verification follow-up must not become implementation work')
  assert.equal(m.obligations.filter(o => o.kind === 'verification').length, 1)
  assert.equal(m.obligations.find(o => o.kind === 'verification')?.status, 'open')
  assert.ok(m.verification_policy.requiredKinds.includes('targeted-tests'))
})

test('restrictive follow-up becomes mission/task constraint and does not create implementation obligation', async () => {
  const store = new MissionStore()
  const seen=[]
  const hook = createChatMessageHook(store, undefined, async(_sid,text,kind)=>seen.push({text,kind}))
  const m = store.start('constraint-followup', 'login bugını düzelt')
  const task = createTask(m,{objective:'fix login bug',role:'coder',category:'standard'})
  const implBefore = m.obligations.filter(o => o.kind === 'implementation').length
  const generationBefore = m.generation
  await callHook(hook, 'constraint-followup', 'yok o dosyaya dokunma')
  assert.equal(m.obligations.filter(o => o.kind === 'implementation').length, implBefore)
  assert.ok(m.constraints.includes('yok o dosyaya dokunma'))
  assert.ok(task.constraints.includes('yok o dosyaya dokunma'))
  assert.equal(m.generation, generationBefore + 1, 'restrictive change invalidates in-flight child instructions')
  assert.deepEqual(seen,[{text:'yok o dosyaya dokunma',kind:'constraint'}])
})

test('busy coder is rebased under new constraint without creating a duplicate task/worker', async () => {
  const store = new MissionStore()
  const m = store.start('constraint-runtime', 'login bugını düzelt')
  const task = createTask(m,{objective:'fix login bug',role:'coder',category:'standard',scope:['src/auth.ts']})
  const worker = createWorker(m,task,'p/code')
  worker.session_id='child-old'; worker.status='busy'; worker.started_at=Date.now(); task.status='running'
  const background = new BackgroundRegistry(); background.set(worker)
  const calls={aborts:[],creates:[],prompts:[]}
  const client={session:{
    abort:async req=>{calls.aborts.push(req)},
    create:async req=>{calls.creates.push(req);return {data:{id:'child-new'}}},
    promptAsync:async req=>{calls.prompts.push(req)},
  }}
  const runtime=new TaskRuntime(client,background,new ConcurrencyScheduler(()=>({global:4})),process.cwd(),process.cwd(),()=>resolveHhcConfig({}),()=>[{id:'p/code',provider:'p',quality:5,cost:1,tags:['coding']}],()=>({}))
  const taskCount=m.tasks.length,workerCount=m.workers.length,oldGeneration=m.generation
  store.amend('constraint-runtime','src/auth.ts dosyasına dokunma','constraint')
  const reconciled=await runtime.reconcileUserConstraint(m,'src/auth.ts dosyasına dokunma')
  assert.equal(reconciled,1)
  assert.equal(m.tasks.length,taskCount)
  assert.equal(m.workers.length,workerCount)
  assert.equal(worker.id,m.workers[0].id)
  assert.equal(task.id,m.tasks[0].id)
  assert.equal(m.generation,oldGeneration+1)
  assert.deepEqual(calls.aborts[0],{path:{id:'child-old'}})
  assert.equal(worker.session_id,'child-new')
  assert.equal(worker.generation_at_spawn,m.generation)
  assert.equal(worker.status,'busy')
  assert.equal(task.status,'running')
  assert.equal(calls.prompts.length,1)
  assert.deepEqual(calls.prompts[0].path,{id:'child-new'})
  assert.match(calls.prompts[0].body.parts[0].text,/src\/auth\.ts dosyasına dokunma/)
  assert.match(calls.prompts[0].body.parts[0].text,/previous child session was aborted/i)
  assert.equal(background.list().filter(w=>w.id===worker.id).length,1)
  assert.equal(background.list().find(w=>w.id===worker.id)?.session_id,'child-new')
})

test('parent system contract exposes current user constraints to direct-mode manager', async () => {
  const store=new MissionStore();const background=new BackgroundRegistry();const m=store.start('direct-constraint','README metnini düzelt')
  store.amend('direct-constraint','package.json dosyasına dokunma','constraint')
  const output={system:[]};await createSystemTransformHook(store,background)({sessionID:'direct-constraint'},output)
  assert.match(output.system[0],/Current user constraints: package\.json dosyasına dokunma/)
  assert.equal(m.tasks.length,0)
})

test('constraint generation reconciliation does not strand a busy read-only worker on the old generation', async () => {
  const store=new MissionStore();const m=store.start('constraint-readonly','repo genelinde API kullanımını bul')
  const task=createTask(m,{objective:'find API usage',role:'repository-explorer',category:'quick',scope:['src']})
  const worker=createWorker(m,task,'p/fast');worker.session_id='explorer-old';worker.status='busy';task.status='running'
  const background=new BackgroundRegistry();background.set(worker)
  const client={session:{abort:async()=>{},create:async()=>({data:{id:'explorer-new'}}),promptAsync:async()=>{}}}
  const runtime=new TaskRuntime(client,background,new ConcurrencyScheduler(()=>({global:4})),process.cwd(),process.cwd(),()=>resolveHhcConfig({}),()=>[{id:'p/fast',provider:'p',quality:3,cost:1,tags:['fast']}],()=>({}))
  store.amend('constraint-readonly','vendor klasörünü inceleme','constraint')
  await runtime.reconcileUserConstraint(m,'vendor klasörünü inceleme')
  assert.equal(worker.generation_at_spawn,m.generation)
  assert.equal(worker.session_id,'explorer-new')
  assert.equal(worker.status,'busy')
  assert.ok(task.constraints.includes('vendor klasörünü inceleme'))
})
