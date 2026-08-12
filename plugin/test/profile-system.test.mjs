// Canonical execution-policy/profile naming regression guard for OpenCode-Hi 0.1.0.
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveHiConfig } from '../dist/config/resolver.js'
import { DEFAULT_HI_CONFIG } from '../dist/config/defaults.js'

test('profile defaults include minimal, balanced, thorough', () => {
  const { profile } = DEFAULT_HI_CONFIG
  assert.deepEqual(Object.keys(profile).sort(), ['balanced','minimal','thorough'])
})

test('canonical execution policies resolve', () => {
  for (const policy of ['minimal','balanced','thorough','adaptive','manual'])
    assert.equal(resolveHiConfig({ executionPolicy:policy }).executionPolicy, policy)
})

test('legacy autonomy field and legacy profile keys are not interpreted', () => {
  assert.equal(resolveHiConfig({ autonomy:'basic' }).executionPolicy, 'adaptive')
  const cfg=resolveHiConfig({profile:{standard:{specialistThreshold:'low'}}})
  assert.equal(cfg.profile.balanced.specialistThreshold, DEFAULT_HI_CONFIG.profile.balanced.specialistThreshold)
})
