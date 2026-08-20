// Doctor model-inventory regression guard.
// M16 requires the effective inventory to remain visible without an arbitrary eight-model presentation cap.

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { runDoctor } from '../dist/doctor/checks.js'

function makeProject() {
  return mkdtempSync(join(tmpdir(), 'hi-doctor-'))
}

function makeDefaultHiConfig() {
  return {
    schemaVersion: 2,
    executionPolicy: 'adaptive',
    compatibility: { mode: 'compatible', validatedOpenCodeVersions: ['1.18.16'] },
    routing: { strategy: 'cost-quality', categoryModels: {}, categoryVariants: {}, roleModels: {}, maxFallbacks: 3, allowedProviders: [], deniedModels: [] },
    parallel: { enabled: true, max: 3, providers: {}, models: {} },
    teamMode: { enabled: false, maxMembers: 4, maxWallMinutes: 45 },
    profile: {
      minimal: { specialistThreshold: 'high', reviewThreshold: 'low' },
      balanced: { specialistThreshold: 'medium', reviewThreshold: 'medium' },
      thorough: { specialistThreshold: 'low', reviewThreshold: 'high' },
    },
  }
}

test('Gap #16: model-inventory check reports first 8 model ids, not just count', () => {
  const project = makeProject()
  try {
    const cfg = makeDefaultHiConfig()
    const store = new MissionStore()
    const mockModels = [
      { id: 'opencode-go/minimax-m3', provider: 'opencode-go', tags: ['balanced'] },
      { id: 'opencode-go/minimax-m3-high', provider: 'opencode-go', tags: ['reasoning'] },
      { id: 'opencode-go/qwen3.7-plus', provider: 'opencode-go', tags: ['coding'] },
    ]
    const checks = runDoctor(cfg, store, project, { models: mockModels })
    const inv = checks.find(c => c.id === 'model-inventory')
    assert.ok(inv, 'model-inventory check must exist')
    assert.equal(inv.status, 'pass')
    assert.match(inv.detail, /opencode-go\/minimax-m3/)
    assert.match(inv.detail, /opencode-go\/qwen3\.7-plus/)
  } finally { rmSync(project, { recursive: true, force: true }) }
})

test('Gap #16: model-inventory with empty inventory passes warn', () => {
  const project = makeProject()
  try {
    const cfg = makeDefaultHiConfig()
    const store = new MissionStore()
    const checks = runDoctor(cfg, store, project, { models: [] })
    const inv = checks.find(c => c.id === 'model-inventory')
    assert.equal(inv.status, 'warn')
    assert.match(inv.detail, /0 effective runtime/)
  } finally { rmSync(project, { recursive: true, force: true }) }
})



test('M16 model-inventory presentation includes entries beyond eight', () => {
  const project = makeProject()
  try {
    const cfg = makeDefaultHiConfig()
    const store = new MissionStore()
    const mockModels = Array.from({length:12},(_,i)=>({id:'provider/model-'+String(i+1),provider:'provider',tags:['balanced']}))
    const inv = runDoctor(cfg, store, project, { models: mockModels }).find(c => c.id === 'model-inventory')
    assert.ok(inv)
    assert.match(inv.detail, /12 effective runtime model\(s\)/)
    assert.match(inv.detail, /provider\/model-12/)
    assert.doesNotMatch(inv.detail, /first 8/)
  } finally { rmSync(project, { recursive: true, force: true }) }
})
