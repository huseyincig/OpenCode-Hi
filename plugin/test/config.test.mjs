import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveHiConfig } from '../dist/config/resolver.js'

test('config defaults are adaptive and bounded', () => {
  const config = resolveHiConfig(undefined)
  assert.equal(config.executionPolicy, 'adaptive')
  assert.equal(config.parallel.max, 3)
  assert.equal('auto' in config.teamMode, false)
})

test('parallel max is clamped', () => {
  assert.equal(resolveHiConfig({ parallel: { max: 999 } }).parallel.max, 8)
  assert.equal(resolveHiConfig({ parallel: { max: 0 } }).parallel.max, 1)
})
