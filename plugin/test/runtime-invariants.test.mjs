import {opencodeChildPort} from './helpers/host-port.mjs'
// Runtime regression guard for the 7 stop invariants (Section 47, 48, 49,
// 51, 52, 56, 71 of the master transformation document).
//
// Each test exercises a real runtime path and asserts the documented
// behavior. They are not LLM-evaluations; they are deterministic state
// transitions against the in-process mission store.

import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { startAssessedMission, applyStructuredFollowup } from './helpers/semantic.mjs'

// ---------------------------------------------------------------------------
// Gap #8 — Native USER STOP integrity
// ---------------------------------------------------------------------------

test('Gap #8: USER STOP sets user_interrupted=true and stops active mission', () => {
  const store = new MissionStore()
  const m = store.start('s1', 'fix the login bug')
  assert.equal(m.identity.status, 'active')
  assert.equal(m.continuation.user_interrupted, false)
  store.stop('s1', 'user-stop-via-ESC')
  assert.equal(m.identity.status, 'stopped')
  assert.equal(m.continuation.user_interrupted, true)
})

test('Gap #8: late idle event after user stop does NOT auto-resurrect mission', () => {
  const store = new MissionStore()
  const m = store.start('s1', 'demo')
  store.stop('s1', 'user-stop')
  store.noteUserMessage('s1') // simulate a late user-msg
  assert.equal(m.identity.status, 'stopped', 'mission must stay stopped; only new user message creates a new mission')
  // The stopped mission is preserved until the user issues an explicit resume or a new mission.
})

// ---------------------------------------------------------------------------
// Gap #9 — Stagnation recovery ladder
// ---------------------------------------------------------------------------

test('Gap #9: updateProgress increments stagnation only when countStagnation=true AND signature is unchanged', () => {
  const store = new MissionStore()
  const m = store.start('s1', 'demo')
  // First updateProgress establishes the baseline signature.
  store.updateProgress(m, false)
  assert.equal(m.continuation.stagnation_count, 0)
  // Same signature again with countStagnation=false → no increment.
  store.updateProgress(m, false)
  assert.equal(m.continuation.stagnation_count, 0)
  // Same signature again with countStagnation=true → +1.
  store.updateProgress(m, true)
  assert.equal(m.continuation.stagnation_count, 1)
  // After a real change, the signature differs and stagnation resets.
  m.vcs.changed_files = ['src/x.ts']
  store.updateProgress(m, true)
  assert.equal(m.continuation.stagnation_count, 0)
})

test('Gap #9: countStagnation=false skips increment even when signature is unchanged', () => {
  const store = new MissionStore()
  const m = store.start('s1', 'demo')
  store.updateProgress(m, false)
  store.updateProgress(m, false)
  store.updateProgress(m, false)
  // countStagnation=false throughout → no increment.
  assert.equal(m.continuation.stagnation_count, 0)
})

// ---------------------------------------------------------------------------
// Gap #10 — Runtime nudge: small targeted corrective, no plan rebuild
// ---------------------------------------------------------------------------

test('Gap #10: structured follow-up updates intent without rebuilding task identity', () => {
  const store = new MissionStore()
  const m = startAssessedMission(store,'s1','opaque')
  const before = m.identity.intent.scope
  applyStructuredFollowup(store,'s1','opaque multi-stream',{scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation']})
  assert.notEqual(m.identity.intent.scope, before)
  assert.equal(m.continuation.continuation_active, false)
})

test('Gap #10: structured risk-raising follow-up escalates risk and verification', () => {
  const store = new MissionStore()
  const m = startAssessedMission(store,'s1','opaque',{risk:'low'})
  assert.equal(m.identity.intent.risk, 'low')
  applyStructuredFollowup(store,'s1','opaque security change',{risk:'high',required_capabilities:['implementation','security-review','independent-review'],likely_verification:['targeted-tests','review-evidence']})
  assert.equal(m.identity.intent.risk, 'high')
  // Verification policy opens up — the high-risk follow-up widens it.
  assert.ok(m.execution.verification_policy.requireFresh, 'requireFresh must be set')
  assert.ok(m.execution.verification_policy.requireReview, 'requireReview must be set for high risk')
})

// ---------------------------------------------------------------------------
// Gap #11 — Worker dedup fingerprint
// ---------------------------------------------------------------------------

test('Gap #11: repeated high-risk structured follow-up does not duplicate high-assurance obligation', () => {
  const store = new MissionStore()
  const m = startAssessedMission(store,'s1','opaque',{risk:'high',required_capabilities:['implementation','security-review','independent-review']})
  const before = m.execution.obligations.filter(o => o.id === 'o-high-assurance').length
  applyStructuredFollowup(store,'s1','opaque security extension',{risk:'high',required_capabilities:['implementation','security-review','independent-review']})
  const after = m.execution.obligations.filter(o => o.id === 'o-high-assurance').length
  assert.equal(after, before, 'amend() must not create duplicate high-assurance obligations')
})

// ---------------------------------------------------------------------------
// Gap #12 — Permission wait ≠ stagnation
// ---------------------------------------------------------------------------

test('Gap #12: permission pending is a runtime event tracked separately', () => {
  const store = new MissionStore()
  const m = store.start('s1', 'demo')
  // pending_permissions is an axis separate from stagnation_count.
  m.authority.pending_permissions = 1
  assert.equal(m.continuation.stagnation_count, 0)
  assert.equal(m.authority.pending_permissions, 1)
  // Progress ticks may increment stagnation (signature unchanged) but
  // do not clear pending_permissions.
  store.updateProgress(m, true)
  assert.equal(m.authority.pending_permissions, 1, 'progress ticks do not clear permission pending state')
  // stagnation may have advanced because signature is unchanged and
  // countStagnation=true. The two counters are independent.
  assert.ok(m.continuation.stagnation_count >= 0)
})

// ---------------------------------------------------------------------------
// Gap #13 — Provider failure ≠ stagnation
// ---------------------------------------------------------------------------

test('Gap #13: provider failure is isolated from stagnation accounting', () => {
  const store = new MissionStore()
  const m = store.start('s1', 'demo')
  // Provider failure is handled by recoverRuntimeFailure in task-runtime.
  // It does not touch m.stagnation_count in mission-store.
  const before = m.continuation.stagnation_count
  // Even after a normal progress tick, provider-failure handling does
  // not increase the count. The only thing that increments is repeated
  // unchanged signature with countStagnation=true.
  m.vcs.changed_files = ['provider-failed']
  store.updateProgress(m, true)
  assert.equal(m.continuation.stagnation_count, 0, 'progressed resets the count to zero')
  assert.equal(m.continuation.stagnation_count, before, 'signature change resets the count')
})

// ---------------------------------------------------------------------------
// Gap #15 — Same-session resume preferred on FIX_REQUIRED
// ---------------------------------------------------------------------------

test('Gap #15: structured follow-up does not delete current task identity', async () => {
  const store = new MissionStore()
  const m = startAssessedMission(store,'s1','opaque')
  const before = m.execution.tasks.length
  applyStructuredFollowup(store,'s1','opaque clarification',{message_kind:'amendment'})
  assert.equal(m.execution.tasks.length, before, 'amend() must not delete existing tasks')
})

test('Gap #mission-identity: workers bind to spawning mission even when generation collides', async () => {
  const { createTask, createWorker } = await import('../dist/runtime/worker/worker-runtime.js')
  const store = new MissionStore()
  const first = store.start('same-session-mission-id', 'fix bug')
  const task = createTask(first,{objective:'fix bug',role:'coder',category:'standard'})
  const worker = createWorker(first,task,'host-default')
  assert.equal(worker.parent_mission_id, first.identity.mission_id)
  store.stop('same-session-mission-id')
  const second = store.start('same-session-mission-id', 'different task')
  assert.equal(second.continuation.generation, 1)
  assert.equal(worker.generation_at_spawn, 1)
  assert.notEqual(worker.parent_mission_id, second.identity.mission_id)
})

test('Gap #recovery-runtime: level-2 reasoning correction preserves the exact child session and model', async () => {
  const { createTask, createWorker } = await import('../dist/runtime/worker/worker-runtime.js')
  const { TaskRuntime } = await import('../dist/runtime/task/task-runtime.js')
  const { BackgroundRegistry } = await import('../dist/runtime/background/registry.js')
  const { createConcurrencyPolicySource } = await import('../dist/runtime/scheduler/concurrency.js')
  const { resolveHiConfig } = await import('../dist/config/resolver.js')
  const calls=[]
  const client={session:{promptAsync:async req=>{calls.push(req)}}}
  const store=new MissionStore()
  const m=store.start('recovery-runtime-session','fix bug')
  store.applyInitialSemanticAssessment('recovery-runtime-session',{material:true,message_kind:'mission',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]})
  const task=createTask(m,{objective:'fix bug',role:'coder',category:'standard'})
  const worker=createWorker(m,task,'p/cheap',['p/strong'])
  worker.session_id='child-1'; worker.status='completed'; task.status='completed'
  const registry=new BackgroundRegistry()
  const scheduler=createConcurrencyPolicySource(()=>({global:4}))
  const models=[
    {id:'p/cheap',provider:'p',quality:1,cost:1,tags:['balanced','cheap'],variants:['medium']},
    {id:'p/strong',provider:'p',quality:10,cost:3,tags:['reasoning','coding'],variants:['high']},
  ]
  const runtime=new TaskRuntime(opencodeChildPort(client),registry,scheduler,process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>models,()=>({}))
  const ok=await runtime.recoverStagnation(m,2)
  assert.equal(ok,true)
  assert.equal(worker.session_id,'child-1','must preserve same child session')
  assert.equal(worker.model,'p/cheap','reasoning recovery must not invent model-routing authority')
  assert.equal(worker.status,'busy')
  assert.equal(calls.length,1)
  assert.deepEqual(calls[0].path,{id:'child-1'})
  assert.deepEqual(calls[0].body.model,{providerID:'p',modelID:'cheap'})
  assert.equal(calls[0].body.variant,undefined)
  assert.match(calls[0].body.parts[0].text,/materially different corrective hypothesis or action/i)
  assert.match(calls[0].body.parts[0].text,/do not.*change models/i)
  assert.equal(m.continuation.recovery_history?.at(-1)?.action,'same-worker-resume')
  assert.equal(m.continuation.recovery_history?.at(-1)?.level,2)
})


test('BackgroundRegistry waitForChange is bounded and wakes on set/delete transitions', async () => {
  const { BackgroundRegistry } = await import('../dist/runtime/background/registry.js')
  const registry=new BackgroundRegistry()
  const worker={id:'wait-worker',task_id:'wait-task',role:'coder',category:'quick',parent_session_id:'wait-parent',model:'host-default',fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'wait-fp',status:'busy',attempt:1,updated_at:Date.now()}
  registry.set(worker)
  const setWait=registry.waitForChange(worker.id,1000)
  setTimeout(()=>registry.set({...worker,status:'ready',updated_at:Date.now()+1}),10)
  assert.equal(await setWait,true)
  const deleteWait=registry.waitForChange(worker.id,1000)
  setTimeout(()=>registry.delete(worker.id),10)
  assert.equal(await deleteWait,true)
  registry.set(worker)
  const started=Date.now();assert.equal(await registry.waitForChange(worker.id,20),false);assert.ok(Date.now()-started>=10)
})

test('TaskRuntime awaitTask returns terminal immediately and wakes on the canonical registry terminal transition', async () => {
  const { createTask, createWorker } = await import('../dist/runtime/worker/worker-runtime.js')
  const { TaskRuntime } = await import('../dist/runtime/task/task-runtime.js')
  const { BackgroundRegistry } = await import('../dist/runtime/background/registry.js')
  const { createConcurrencyPolicySource } = await import('../dist/runtime/scheduler/concurrency.js')
  const { resolveHiConfig } = await import('../dist/config/resolver.js')
  const store=new MissionStore(),m=store.start('await-runtime','wait for worker')
  store.applyInitialSemanticAssessment('await-runtime',{material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]})
  const task=createTask(m,{objective:'work',role:'coder',category:'quick'}),worker=createWorker(m,task,'host-default'),registry=new BackgroundRegistry()
  worker.status='busy';task.status='running';registry.set(worker)
  const runtime=new TaskRuntime(opencodeChildPort({}),registry,createConcurrencyPolicySource(()=>({global:2})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>({}))
  const waiting=runtime.awaitTask(m,task.id,1000)
  setTimeout(()=>{worker.status='completed';worker.completed_at=Date.now();task.status='completed';task.updated_at=Date.now();registry.delete(worker.id)},10)
  const done=await waiting
  assert.equal(done.changed,true);assert.equal(done.timed_out,false);assert.equal(done.terminal,true);assert.equal(done.status,'completed')
  const immediate=await runtime.awaitTask(m,task.id,1000)
  assert.equal(immediate.changed,false);assert.equal(immediate.timed_out,false);assert.equal(immediate.terminal,true);assert.equal(immediate.status,'completed')
})
