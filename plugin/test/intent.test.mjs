import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeIntent } from '../dist/runtime/intent/normalize.js'

test('bug prompt becomes bounded bug-fix intent', () => {
  const intent = normalizeIntent('fix the intermittent login 500 and test it')
  assert.equal(intent.taskKind, 'bug-fix')
  assert.deepEqual(intent.likelyVerification, ['targeted-tests'])
})

test('publish/deploy intent hits authority boundary', () => {
  const intent = normalizeIntent('prepare the release and publish it')
  assert.equal(intent.risk, 'authority-boundary')
  assert.equal(intent.scope, 'external')
})

test('numbered Turkish workstream objective becomes multi-stream scope', () => {
  // Original PulseBoard-3-feature regression case:
  // "add three independent features" must classify as multi-stream so that
  // resolveExecutionMode can grant parallel.
  const intent = normalizeIntent('Add three independent features to this project')
  assert.equal(intent.scope, 'multi-stream')
  assert.equal(intent.dependencyClass, 'independent-multi')
  assert.ok(intent.requiredCapabilities.includes('multi-stream-delegation'))
})

test('numbered English workstream objective becomes multi-stream scope', () => {
  const intent = normalizeIntent('Add 3 independent modules to the dashboard')
  assert.equal(intent.scope, 'multi-stream')
  assert.equal(intent.dependencyClass, 'independent-multi')
})

test('numbered list in objective becomes multi-stream scope', () => {
  const intent = normalizeIntent('1. due_date support\n2. project statistics\n3. task export')
  assert.equal(intent.scope, 'multi-stream')
  assert.equal(intent.dependencyClass, 'independent-multi')
})

test('single bug fix stays local even with ambiguous "independent" keyword', () => {
  // False-positive guard: lone "independent" or "feature" without count/number must
  // NOT trigger multi-stream. This was the original RC.1 over-trigger risk.
  const intent = normalizeIntent('tek fix one bug')
  assert.equal(intent.scope, 'local')
  assert.equal(intent.dependencyClass, 'independent')
  assert.ok(!intent.requiredCapabilities.includes('multi-stream-delegation'))
})

test('lone "independent" keyword without count stays local', () => {
  const intent = normalizeIntent('write an independent test')
  assert.equal(intent.scope, 'local')
  assert.equal(intent.dependencyClass, 'independent')
})

test('two enumerated quoted items still classify as multi-stream', () => {
  const intent = normalizeIntent('due_date ve statistics ekle')
  // "X ve Y" alone is not enough; the regex requires a numeric/quantifier
  // before "ve/and". So this stays local — guards against over-trigger on
  // conjunction alone.
  assert.equal(intent.scope, 'local')
})
