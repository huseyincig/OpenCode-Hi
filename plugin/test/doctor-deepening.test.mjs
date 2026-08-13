// Doctor deepening regression guard (2.0.7).
// Verifies the new doctor checks:
// 1. `model-inventory` now reports the first 8 model ids, not just the count.

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
    teamMode: { enabled: false, auto: false, maxMembers: 4, maxMessages: 24, maxTurns: 12, maxWallMinutes: 45 },
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
    assert.match(inv.detail, /0 runtime/)
  } finally { rmSync(project, { recursive: true, force: true }) }
})

