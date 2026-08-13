import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { createSystemTransformHook } from '../dist/hooks/system-transform.js'

function makeWorker(loadedSkills = []) {
  return {
    id: 'w1', task_id: 't1', role: 'coder', category: 'standard',
    parent_session_id: 's1', model: 'host-default', fallbacks: [],
    loaded_skills: loadedSkills, methodologies: [], fingerprint: 'f1', status: 'busy',
    generation_at_spawn: 1, session_id: 'w1_session',
  }
}

test('system-transform injects planning directive when hi-architecture-decisions skill is loaded', async () => {
  const store = new MissionStore()
  const bg = new BackgroundRegistry()
  store.start('s1', 'add three independent features')
  const m = store.get('s1')
  m.workers.push(makeWorker(['hi-architecture-decisions']))
  bg.set(m.workers[0])
  const hook = createSystemTransformHook(store, bg)
  const output = { system: [] }
  await hook({ sessionID: 'w1_session' }, output)
  assert.equal(output.system.length, 1)
  const text = output.system[0]
  assert.match(text, /Architecture decision methodology active/)
  assert.match(text, /durable context\/decision\/alternatives\/consequences/)
  assert.doesNotMatch(text, /superpowers/i)
  assert.match(text, /Scope: multi-stream/)
  assert.match(text, /Execution mode: parallel/)
  assert.match(text, /multiple independent workstreams detected in objective/)
})

test('system-transform omits planning directive when hi-architecture-decisions is not loaded', async () => {
  const store = new MissionStore()
  const bg = new BackgroundRegistry()
  store.start('s1', 'tek fix one bug')
  const m = store.get('s1')
  m.workers.push(makeWorker(['hi-test-strategy']))
  bg.set(m.workers[0])
  const hook = createSystemTransformHook(store, bg)
  const output = { system: [] }
  await hook({ sessionID: 'w1_session' }, output)
  const text = output.system[0]
  assert.doesNotMatch(text, /Architecture decision methodology active/)
  assert.doesNotMatch(text, /superpowers/i)
})

test('system-transform injects scope and execution mode reason (parent session)', async () => {
  const store = new MissionStore()
  store.start('s1', 'fix one bug')
  const hook = createSystemTransformHook(store)
  const output = { system: [] }
  await hook({ sessionID: 's1' }, output)
  const text = output.system[0]
  assert.match(text, /Scope: local/)
  assert.match(text, /Execution mode: single \(minimum sufficient execution\)/)
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

test('system-transform skips child whose generation is stale', async () => {
  const store = new MissionStore()
  const bg = new BackgroundRegistry()
  store.start('s1', 'tek bir bug')
  const m = store.get('s1')
  const w = makeWorker(['hi-architecture-decisions'])
  w.generation_at_spawn = 99 // stale
  m.workers.push(w)
  bg.set(w)
  const hook = createSystemTransformHook(store, bg)
  const output = { system: [] }
  await hook({ sessionID: 'w1_session' }, output)
  assert.equal(output.system.length, 0)
})


test('system-transform requires child delegation for an independent review obligation', async () => {
  const store = new MissionStore()
  store.start('s-independent', 'Perform an independent review of src/a.ts for correctness')
  const m = store.get('s-independent')
  assert.equal(m.verification_policy.requireReview, true)
  const hook = createSystemTransformHook(store)
  const output = { system: [] }
  await hook({ sessionID: 's-independent' }, output)
  const text = output.system[0]
  assert.match(text, /Independent reviewer required/)
  assert.match(text, /hi_task_start/)
  assert.match(text, /parent evidence cannot close the review obligation/)
  assert.match(text, /Do not substitute parent self-review/)
})
