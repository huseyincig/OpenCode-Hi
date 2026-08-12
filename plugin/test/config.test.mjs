import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveHhcConfig } from '../dist/config/resolver.js'

test('config defaults are SMART and bounded', () => {
  const config = resolveHhcConfig(undefined)
  assert.equal(config.autonomy, 'smart')
  assert.equal(config.parallel.max, 3)
  assert.equal(config.teamMode.auto, false)
})

test('parallel max is clamped', () => {
  assert.equal(resolveHhcConfig({ parallel: { max: 999 } }).parallel.max, 8)
  assert.equal(resolveHhcConfig({ parallel: { max: 0 } }).parallel.max, 1)
})
