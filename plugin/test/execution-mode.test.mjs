import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveExecutionMode } from '../dist/runtime/routing/execution-mode.js'
import { normalizeIntent } from '../dist/runtime/intent/normalize.js'

test('multi-stream objective resolves to parallel', () => {
  // PulseBoard 3-feature regression case.
  const intent = normalizeIntent('Add three independent features to this project')
  const decision = resolveExecutionMode(intent)
  assert.equal(decision.mode, 'parallel')
  assert.ok(decision.reason.some(r => r.includes('multi-stream') || r.includes('independent workstreams')))
})

test('single bounded bug fix stays single', () => {
  const intent = normalizeIntent('fix the intermittent login 500 and test it')
  assert.equal(intent.scope, 'local')
  const decision = resolveExecutionMode(intent)
  assert.equal(decision.mode, 'single')
  assert.equal(decision.reason[0], 'minimum sufficient execution')
})

test('review taskKind with multiple reviewers without multi-stream stays single', () => {
  // Regression guard: a review taskKind alone does NOT force parallel — the
  // single short-circuit on `scope==='local'` wins unless the objective ALSO
  // classifies as multi-stream. This preserves the original
  // "minimum sufficient execution" rule for review.
  const intent = normalizeIntent('security review ve visual review yap')
  assert.equal(intent.taskKind, 'review')
  const decision = resolveExecutionMode(intent)
  assert.equal(decision.mode, 'single')
  assert.equal(decision.reason[0], 'minimum sufficient execution')
})

test('multi-stream overrides local short-circuit and does not regress single-scope tasks', () => {
  const multi = normalizeIntent('4 independent features ekle')
  const local = normalizeIntent('fix one bug')
  assert.equal(resolveExecutionMode(multi).mode, 'parallel')
  assert.equal(resolveExecutionMode(local).mode, 'single')
})

test('authority-boundary objective never goes parallel even with multi-stream markers', () => {
  // Publish intent + multi-stream enumerator: authority-boundary must win.
  const intent = normalizeIntent('publish three independent features')
  assert.equal(intent.risk, 'authority-boundary')
  const decision = resolveExecutionMode(intent)
  assert.equal(decision.mode, 'single')
})
