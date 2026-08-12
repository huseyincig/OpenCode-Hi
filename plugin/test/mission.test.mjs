import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'

test('mission creates obligations without spawning workers', () => {
  const store = new MissionStore()
  const mission = store.start('s1', 'footerdaki yazım hatasını düzelt')
  assert.equal(mission.execution_mode, 'single')
  assert.equal(mission.workers.length, 0)
  assert.ok(mission.obligations.some(o => o.kind === 'verification'))
})

test('explicit stop is sticky until resume', () => {
  const store = new MissionStore()
  store.start('s1', 'bugı düzelt')
  store.stop('s1')
  assert.equal(store.get('s1')?.user_interrupted, true)
  assert.equal(store.get('s1')?.status, 'stopped')
  store.resume('s1')
  assert.equal(store.get('s1')?.status, 'active')
})

test('amend() recomputes execution_mode from single to parallel on multi-stream follow-up', () => {
  const store = new MissionStore()
  store.start('s1', 'tek bir bug düzelt')
  assert.equal(store.get('s1').execution_mode, 'single')
  assert.equal(store.get('s1').intent.scope, 'local')
  store.amend('s1', 'üç bağımsız geliştirme ekle')
  const m = store.get('s1')
  assert.equal(m.intent.scope, 'multi-stream')
  assert.equal(m.intent.dependencyClass, 'independent-multi')
  assert.equal(m.execution_mode, 'parallel')
})

test('amend() widens scope from local to multi-stream', () => {
  const store = new MissionStore()
  store.start('s1', 'bir bug düzelt')
  assert.equal(store.get('s1').intent.scope, 'local')
  store.amend('s1', 'üç bağımsız geliştirme ekle')
  assert.equal(store.get('s1').intent.scope, 'multi-stream')
})

test('amend() preserves team mode across follow-up', () => {
  const store = new MissionStore()
  store.start('s1', 'tek bir bug düzelt')
  store.get('s1').execution_mode = 'team'
  store.amend('s1', 'üç bağımsız geliştirme ekle')
  assert.equal(store.get('s1').execution_mode, 'team')
})

test('amend() preserves parallel when active workers exist (safe direction)', () => {
  // Bug under RC.1: parallel → single mid-mission would invalidate active workers.
  // Guard: keep parallel if active workers exist, even if follow-up intent would downgrade.
  const store = new MissionStore()
  store.start('s1', 'üç bağımsız geliştirme ekle')
  store.get('s1').execution_mode = 'parallel'
  store.get('s1').workers.push({
    id: 'w1', task_id: 't1', role: 'coder', category: 'standard',
    parent_session_id: 's1', model: 'host-default', fallbacks: [],
    loaded_skills: [], methodologies: [], fingerprint: 'f1', status: 'busy',
  })
  store.amend('s1', 'tek bir bug düzelt')
  assert.equal(store.get('s1').execution_mode, 'parallel')
})

test('amend() does not downgrade parallel when scope is still multi-stream (widen-only)', () => {
  // Scope is widen-only: follow-up "tek bir bug düzelt" cannot shrink the
  // existing multi-stream signal. The mission-level multi-stream indicator
  // remains authoritative until mission restart.
  const store = new MissionStore()
  store.start('s1', 'üç bağımsız geliştirme ekle')
  assert.equal(store.get('s1').execution_mode, 'parallel')
  store.amend('s1', 'tek bir bug düzelt')
  assert.equal(store.get('s1').intent.scope, 'multi-stream')
  assert.equal(store.get('s1').execution_mode, 'parallel')
})

test('amend() recomputes parallel→single when scope itself widens down to local', () => {
  // The only way parallel→single can happen via amend() is if the follow-up
  // already had a wider scope signal that the original mission pulled inward.
  // In practice, original scope is local and follow-up introduces multi-stream
  // (single→parallel). The reverse (parallel→single) requires explicit
  // mission restart, not amend().
  const store = new MissionStore()
  store.start('s1', 'üç bağımsız geliştirme ekle')
  store.get('s1').intent.scope = 'local' // force-override (simulating prior state)
  store.get('s1').execution_mode = 'parallel'
  store.amend('s1', 'tek bir bug düzelt')
  // scope stays local (widen-only), execution_mode recompute: local+cap<=1 → single
  assert.equal(store.get('s1').intent.scope, 'local')
  assert.equal(store.get('s1').execution_mode, 'single')
})

test('amend() never relaxes authority-boundary safety', () => {
  // Even if follow-up classifies as multi-stream, authority-boundary must
  // keep execution_mode=single — resolveExecutionMode vetoes it.
  const store = new MissionStore()
  store.start('s1', 'release hazırla ve yayınla')
  assert.equal(store.get('s1').risk, 'authority-boundary')
  assert.equal(store.get('s1').execution_mode, 'single')
  store.amend('s1', 'üç bağımsız geliştirme ekle')
  assert.equal(store.get('s1').execution_mode, 'single')
  assert.equal(store.get('s1').risk, 'authority-boundary')
})

test('amend() raises risk when follow-up risk is higher', () => {
  const store = new MissionStore()
  store.start('s1', 'bir refactor yap')
  assert.equal(store.get('s1').risk, 'low')
  store.amend('s1', 'auth endpoint ekle')
  assert.equal(store.get('s1').risk, 'high')
})

test('amend() does not lower risk when follow-up risk is lower', () => {
  const store = new MissionStore()
  store.start('s1', 'auth endpoint ekle')
  assert.equal(store.get('s1').risk, 'high')
  store.amend('s1', 'bir typo düzelt')
  assert.equal(store.get('s1').risk, 'high')
})
