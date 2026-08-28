import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { createSystemTransformHook } from '../dist/hooks/system-transform.js'
import { startAssessedMission } from './helpers/semantic.mjs'

function makeWorker(mission, selectedMethodologies = []) {
  return {
    id: 'w1', task_id: 't1', role: 'coder', category: 'standard',
    parent_session_id: mission.identity.session_id, parent_mission_id: mission.identity.mission_id,
    model: 'host-default', fallbacks: [], selected_methodologies: selectedMethodologies,
    loaded_methodologies: [], methodologies: [], fingerprint: 'f1', status: 'busy', attempt: 0,
    generation_at_spawn: mission.continuation.generation, session_id: 'w1_session', updated_at: Date.now(),
  }
}

test('system-transform projects selected architecture methodology without duplicating methodology body', async () => {
  const store = new MissionStore()
  const bg = new BackgroundRegistry()
  startAssessedMission(store,'s1','opaque multi-stream architecture task',{scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['design-exploration','multi-stream-delegation'],intent_signals:['intent.architecture-decision']})
  const m = store.get('s1')
  m.execution.workers.push(makeWorker(m,['hi-architecture-decisions']))
  bg.set(m.execution.workers[0])
  const hook = createSystemTransformHook(store, bg)
  const output = { system: [] }
  await hook({ sessionID: 'w1_session' }, output)
  assert.equal(output.system.length, 1)
  const text = output.system[0]
  assert.match(text, /Active methodologies: hi-architecture-decisions/)
  assert.doesNotMatch(text, /durable context\/decision\/alternatives\/consequences/)
  assert.doesNotMatch(text, /superpowers/i)
  assert.match(text, /Current task\/worker: task=t1:/)
})

test('system-transform omits unselected architecture methodology from runtime projection', async () => {
  const store = new MissionStore()
  const bg = new BackgroundRegistry()
  startAssessedMission(store,'s1','opaque local task')
  const m = store.get('s1')
  m.execution.workers.push(makeWorker(m,['hi-test-strategy']))
  bg.set(m.execution.workers[0])
  const hook = createSystemTransformHook(store, bg)
  const output = { system: [] }
  await hook({ sessionID: 'w1_session' }, output)
  const text = output.system.join('\n')
  assert.doesNotMatch(text, /Active methodologies: hi-architecture-decisions/)
  assert.doesNotMatch(text, /superpowers/i)
})

test('system-transform injects stable policy plus bounded parent runtime projection', async () => {
  const store = new MissionStore()
  startAssessedMission(store,'s1','opaque local task')
  const hook = createSystemTransformHook(store)
  const output = { system: [] }
  await hook({ sessionID: 's1' }, output)
  assert.equal(output.system.length,1)
  assert.match(output.system[0],/Hi MISSION RUNTIME PROJECTION/)
  assert.match(output.system[0],/Objective: opaque local task/)
  assert.match(output.system[0],/Obligations:/)
})

test('system-transform is no-op for inactive missions', async () => {
  const store = new MissionStore()
  store.start('s1', 'fix one bug')
  store.stop('s1')
  const hook = createSystemTransformHook(store)
  const output = { system: [] }
  await hook({ sessionID: 's1' }, output)
  assert.equal(output.system.length, 0)
})


test('system-transform emits one terminal stop projection for a completed parent mission',async()=>{
  const store=new MissionStore();const m=startAssessedMission(store,'s-complete','fix one bug',{task_kind:'implementation',scope:'local',risk:'low',required_capabilities:['implementation','verification'],likely_verification:['targeted-tests'],likely_targets:['src/a.ts']})
  for(const o of m.execution.obligations){o.status='closed';o.closedAt=Date.now()}store.complete('s-complete')
  const hook=createSystemTransformHook(store),output={system:[]};await hook({sessionID:'s-complete'},output);await hook({sessionID:'s-complete'},output)
  assert.deepEqual(output.system,['Hi MISSION COMPLETE: required evidence and obligations are closed. Stop; do not invoke more tools.'])
})

test('system-transform skips child whose generation is stale', async () => {
  const store = new MissionStore()
  const bg = new BackgroundRegistry()
  store.start('s1', 'tek bir bug')
  const m = store.get('s1')
  const w = makeWorker(m,['hi-architecture-decisions'])
  w.generation_at_spawn = 99 // stale
  m.execution.workers.push(w)
  bg.set(w)
  const hook = createSystemTransformHook(store, bg)
  const output = { system: [] }
  await hook({ sessionID: 'w1_session' }, output)
  assert.equal(output.system.length, 0)
})


test('system-transform requires child delegation for an independent review obligation', async () => {
  const store = new MissionStore()
  startAssessedMission(store,'s-independent','opaque independent review',{task_kind:'review',required_capabilities:['review','independent-review'],likely_verification:['review-evidence'],likely_targets:['src/a.ts']})
  const m = store.get('s-independent')
  assert.equal(m.execution.verification_policy.requireReview, true)
  const hook = createSystemTransformHook(store)
  const output = { system: [] }
  await hook({ sessionID: 's-independent' }, output)
  const text = output.system.join('\n')
  assert.match(text, /independent-review-required/)
  assert.match(text, /gate-reviewer:open/)
})


test('pending semantic gate distinguishes material implementation scope from verifier-only files and sequencing', async () => {
  const store = new MissionStore()
  store.start('s-semantic-coherence','Fix one production file; keep the regression test unchanged and run it afterward')
  const hook = createSystemTransformHook(store)
  const output = { system: [] }
  await hook({ sessionID: 's-semantic-coherence' }, output)
  const text=output.system.join('\n')
  assert.match(text,/scope\/dependency describe material change units/)
  assert.match(text,/user-unchanged test files excluded/)
  assert.match(text,/one change\+verification != sequential/)
  assert.match(text,/task_kind=implementation\|bug-fix\|diagnosis\|review/)
  assert.match(text,/diagnosis is read-only root cause\/no fix/)
  assert.match(text,/otherwise intent\.debugging requires material diagnosis \+ repository-analysis/)
})
