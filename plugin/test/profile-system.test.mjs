// 3-profile system regression guard (2.0.5).
// Verifies that:
// 1. The config schema accepts 'basic' | 'standard' | 'powerful' | 'smart' | 'manual'.
// 2. The resolver applies the matching profile settings when input.autonomy is set.
// 3. Defaults include all three profiles with sensible thresholds.

import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveHhcConfig } from '../dist/config/resolver.js'
import { DEFAULT_HHC_CONFIG } from '../dist/config/defaults.js'

test('profile defaults include basic, standard, powerful', () => {
  const { profile } = DEFAULT_HHC_CONFIG
  assert.ok(profile.basic, 'basic missing')
  assert.ok(profile.standard, 'standard missing')
  assert.ok(profile.powerful, 'powerful missing')
  // Verify the threshold axis exists on each profile.
  for (const [, p] of Object.entries(profile)) {
    assert.ok(['low','medium','high'].includes(p.specialistThreshold), 'specialistThreshold invalid')
    assert.ok(['low','medium','high'].includes(p.parallelThreshold), 'parallelThreshold invalid')
    assert.ok(['low','medium','high'].includes(p.reviewThreshold), 'reviewThreshold invalid')
    assert.ok(['low','medium','high'].includes(p.costSensitivity), 'costSensitivity invalid')
    assert.ok(['standard','high'].includes(p.qualityFloor), 'qualityFloor invalid')
  }
})

test('basic profile has high specialist / parallel / low review — cost-sensitive', () => {
  const cfg = resolveHhcConfig({ autonomy: 'basic' })
  assert.equal(cfg.autonomy, 'basic')
  // Defaults from DEFAULT_HHC_CONFIG.profile.basic are preserved.
  assert.equal(cfg.profile.basic.specialistThreshold, 'high')
  assert.equal(cfg.profile.basic.parallelThreshold, 'high')
  assert.equal(cfg.profile.basic.reviewThreshold, 'low')
  assert.equal(cfg.profile.basic.costSensitivity, 'high')
})

test('powerful profile has low specialist / parallel / high review', () => {
  const cfg = resolveHhcConfig({ autonomy: 'powerful' })
  assert.equal(cfg.autonomy, 'powerful')
  assert.equal(cfg.profile.powerful.specialistThreshold, 'low')
  assert.equal(cfg.profile.powerful.parallelThreshold, 'low')
  assert.equal(cfg.profile.powerful.reviewThreshold, 'high')
  assert.equal(cfg.profile.powerful.costSensitivity, 'low')
  assert.equal(cfg.profile.powerful.qualityFloor, 'high')
})

test('standard profile is balanced', () => {
  const cfg = resolveHhcConfig({ autonomy: 'standard' })
  assert.equal(cfg.autonomy, 'standard')
  assert.equal(cfg.profile.standard.specialistThreshold, 'medium')
  assert.equal(cfg.profile.standard.parallelThreshold, 'medium')
  assert.equal(cfg.profile.standard.reviewThreshold, 'medium')
  assert.equal(cfg.profile.standard.costSensitivity, 'medium')
})

test('legacy autonomy values still accept (smart, manual)', () => {
  // Smart and manual continue to work after the 3-profile expansion.
  assert.equal(resolveHhcConfig({ autonomy: 'smart' }).autonomy, 'smart')
  assert.equal(resolveHhcConfig({ autonomy: 'manual' }).autonomy, 'manual')
})

test('unknown autonomy falls back to default (smart) without error', () => {
  // Legitimate robustness: garbage input doesn't crash, falls back.
  assert.equal(resolveHhcConfig({ autonomy: 'garbage' }).autonomy, 'smart')
})

test('input.profile overrides partial fields per profile', () => {
  const cfg = resolveHhcConfig({
    autonomy: 'standard',
    profile: {
      standard: { specialistThreshold: 'low' },
    },
  })
  // Overridden field is applied.
  assert.equal(cfg.profile.standard.specialistThreshold, 'low')
  // Non-overridden fields default to defaults.
  assert.equal(cfg.profile.standard.parallelThreshold, 'medium')
  assert.equal(cfg.profile.standard.reviewThreshold, 'medium')
})
