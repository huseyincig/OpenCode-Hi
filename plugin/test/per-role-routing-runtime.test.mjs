// Per-role routing runtime regression guard (2.0.4).
// Verifies that `resolveModel` uses `config.routing.roleModels[role]`
// as primary when the role is configured AND the model is in the
// runtime inventory, before falling back to scoring.
//
// Bug: lab evidence in 2.0.3 showed host-default path as the only
// verified path. Per-role routing was not exercised against a real
// provider inventory. This file locks the per-role path so that
// regressions in merge ordering or scoring fast-path are caught.

import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveModel } from '../dist/runtime/routing/model-resolver.js'
import { resolveHiConfig } from '../dist/config/resolver.js'

const OPENCODE_GO_INVENTORY = [
  { id: 'opencode-go/minimax-m3', provider: 'opencode-go', tags: ['balanced', 'coding'], variants: ['medium', 'low', 'none'] },
  { id: 'opencode-go/minimax-m3-high', provider: 'opencode-go', tags: ['reasoning', 'coding', 'high-assurance'], variants: ['high', 'xhigh'] },
  { id: 'opencode-go/minimax-m3-low', provider: 'opencode-go', tags: ['fast', 'cheap'], variants: ['low', 'minimal', 'none'] },
]

function cfgWith(roleModels) {
  return resolveHiConfig({ routing: { roleModels } })
}

test('per-role primary: roleModels supplies primary when role model is in inventory', () => {
  const cfg = cfgWith({ coder: ['opencode-go/minimax-m3'] })
  const m = resolveModel('standard', OPENCODE_GO_INVENTORY, cfg, undefined, 'coder', {})
  assert.equal(m.primary, 'opencode-go/minimax-m3')
  assert.ok(m.reason.some(r => /role override|coder/.test(r)), 'reason must include role override')
})

test('per-role fast-path: when roleConfig primary is available, primary is the configured one', () => {
  const cfg = cfgWith({ coder: ['opencode-go/minimax-m3'] })
  const m = resolveModel('standard', OPENCODE_GO_INVENTORY, cfg, undefined, 'coder', {})
  // When roleConfig is available in inventory, role override wins over scoring.
  assert.equal(m.primary, 'opencode-go/minimax-m3')
  // The configured role model appears in the role-override reason trail.
  assert.ok(m.reason.some(r => r.includes('role override') || r.includes('coder')))
})

test('per-role fallback: when roleModel is NOT in inventory, scoring fallback applies', () => {
  const cfg = cfgWith({ coder: ['opencode-go/nonexistent-model'] })
  const m = resolveModel('standard', OPENCODE_GO_INVENTORY, cfg, undefined, 'coder', {})
  // Primary must NOT be the non-existent model.
  assert.notEqual(m.primary, 'opencode-go/nonexistent-model')
  // The scoring fallback must select one of the actually-available models.
  assert.ok(OPENCODE_GO_INVENTORY.some(x => x.id === m.primary),
    `primary ${m.primary} must be from runtime inventory`)
})

test('per-role variant: configured role model variant honored for critical category', () => {
  const cfg = cfgWith({ 'security-reviewer': ['opencode-go/minimax-m3-high'] })
  const m = resolveModel('critical', OPENCODE_GO_INVENTORY, cfg, undefined, 'security-reviewer', {})
  assert.equal(m.primary, 'opencode-go/minimax-m3-high')
  // For critical category, variant preference is xhigh/max/high.
  // The chosen model exposes those variants.
  assert.match(m.primaryVariant ?? '', /xhigh|max|high/)
})

test('per-role: missing role config falls back to scoring', () => {
  const cfg = cfgWith({}) // empty
  const m = resolveModel('standard', OPENCODE_GO_INVENTORY, cfg, undefined, 'coder', {})
  // No roleModels config, scoring-based primary.
  assert.ok(OPENCODE_GO_INVENTORY.some(x => x.id === m.primary))
})

test('per-role: explicit user override (input.model) wins over roleModels', () => {
  const cfg = cfgWith({ coder: ['opencode-go/minimax-m3'] })
  const m = resolveModel('standard', OPENCODE_GO_INVENTORY, cfg, 'opencode-go/minimax-m3-low', 'coder', {})
  assert.equal(m.primary, 'opencode-go/minimax-m3-low')
})

test('per-role: empty inventory falls back to host-default', () => {
  const cfg = cfgWith({ coder: ['opencode-go/minimax-m3'] })
  const m = resolveModel('standard', [], cfg, undefined, 'coder', {})
  assert.equal(m.primary, 'host-default')
})

test('per-role: native provider policy deny removes role model', () => {
  const cfg = cfgWith({ coder: ['opencode-go/minimax-m3'] })
  // native-adapter reads disabled_providers from host config.
  const hostConfig = { disabled_providers: ['opencode-go'] }
  const m = resolveModel('standard', OPENCODE_GO_INVENTORY, cfg, undefined, 'coder', hostConfig)
  // The roleModel's provider is denied, so it must not be primary.
  assert.notEqual(m.primary, 'opencode-go/minimax-m3')
})

test('M11 admitted empirical feedback may rerank configured role priors without leaving the configured set', () => {
  const inventory = [
    { id: 'p/a', provider: 'p', tags: ['balanced'], quality: 5, cost: .2 },
    { id: 'p/b', provider: 'p', tags: ['balanced'], quality: 5, cost: .2 },
    { id: 'p/outside', provider: 'p', tags: ['balanced'], quality: 20, cost: .01 },
  ]
  const cfg = cfgWith({ coder: ['p/a', 'p/b'] })
  const feedback = {
    samples: { 'p/a': 2, 'p/b': 2 }, confidence: { 'p/a': 'low', 'p/b': 'low' },
    failures: { 'p/a': 2 }, successes: { 'p/b': 2 },
    verification_failures: { 'p/a': 2 }, verification_passes: { 'p/b': 2 },
  }
  const r = resolveModel('standard', inventory, cfg, undefined, 'coder', undefined, feedback)
  assert.equal(r.primary, 'p/b')
  assert.ok(r.reason.includes('empirical-feedback-reranked-configured-priors'))
  assert.ok(!r.reason.some(x => x.includes('recommended-fast-path')))
  assert.deepEqual([r.primary, ...r.fallbacks].slice(0, 2), ['p/b', 'p/a'])
})

test('M11 sparse feedback keeps configured role prior on the no-scoring fast path', () => {
  const inventory = [
    { id: 'p/a', provider: 'p', tags: ['balanced'], quality: 5, cost: .2 },
    { id: 'p/b', provider: 'p', tags: ['balanced'], quality: 5, cost: .2 },
  ]
  const cfg = cfgWith({ coder: ['p/a', 'p/b'] })
  const feedback = { samples: { 'p/a': 1 }, failures: { 'p/a': 1 }, confidence: { 'p/a': 'insufficient' } }
  const r = resolveModel('standard', inventory, cfg, undefined, 'coder', undefined, feedback)
  assert.equal(r.primary, 'p/a')
  assert.ok(r.reason.some(x => x.includes('recommended-fast-path')))
})

test('M11 explicit model override remains authoritative over admitted empirical role feedback', () => {
  const inventory = [
    { id: 'p/a', provider: 'p', tags: ['balanced'], quality: 5, cost: .2 },
    { id: 'p/b', provider: 'p', tags: ['balanced'], quality: 5, cost: .2 },
  ]
  const cfg = cfgWith({ coder: ['p/a', 'p/b'] })
  const feedback = { samples: { 'p/a': 2, 'p/b': 2 }, failures: { 'p/a': 2 }, successes: { 'p/b': 2 }, confidence: { 'p/a': 'low', 'p/b': 'low' } }
  const r = resolveModel('standard', inventory, cfg, 'p/a', 'coder', undefined, feedback)
  assert.equal(r.primary, 'p/a')
  assert.ok(r.reason.includes('explicit override'))
  assert.ok(!r.reason.includes('empirical-feedback-reranked-configured-priors'))
})

test('M11 live OpenCode Go inventory uses the canonical default coder prior without persisted project routing', () => {
  const inventory = [
    { id: 'opencode-go/mimo-v2.5', provider: 'opencode-go', tags: ['fast','cheap','balanced'], quality: 5 },
    { id: 'opencode-go/deepseek-v4-flash', provider: 'opencode-go', tags: ['fast','cheap','coding'], quality: 5 },
    { id: 'opencode-go/qwen3.7-plus', provider: 'opencode-go', tags: ['reasoning','coding'], quality: 5 },
    { id: 'opencode-go/mimo-v2.5-pro', provider: 'opencode-go', tags: ['reasoning','high-assurance'], quality: 5 },
    { id: 'opencode/laguna-s-2.1-free', provider: 'opencode', tags: ['fast','cheap'], quality: 99, cost: 0 },
  ]
  const cfg = cfgWith({})
  const r = resolveModel('quick', inventory, cfg, undefined, 'coder', {})
  assert.equal(r.primary, 'opencode-go/deepseek-v4-flash')
  assert.ok(r.reason.includes('default role prior:coder'))
  assert.ok(r.reason.some(x => x.includes('recommended-fast-path')))
})
