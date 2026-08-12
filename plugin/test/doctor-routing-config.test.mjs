// Regression guard for the 2.0.3 doctor `routing-config` check that
// surfaces `.opencode/oho-routing.json` roleModels as an explicit
// `pass` line. Lab dogfood in 2.0.2 reported this gap as a P2
// observation: the doctor confirmed config-hook wiring but printed
// only `roleOverrides=0` from `model-fallback`, with no explicit
// roleModels-active assertion. This file locks the new check.

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { runDoctor, formatDoctor } from '../dist/doctor/checks.js'

function makeProject() {
  return mkdtempSync(join(tmpdir(), 'oho-routing-doctor-'))
}

function writeProjectRouting(project, body) {
  mkdirSync(join(project, '.opencode'), { recursive: true })
  writeFileSync(join(project, '.opencode', 'oho-routing.json'), JSON.stringify(body), 'utf8')
}

function defaultHhcConfig() {
  return {
    schemaVersion: 2,
    autonomy: 'smart',
    compatibility: { mode: 'compatible', validatedOpenCodeVersions: [] },
    routing: {
      strategy: 'cost-quality',
      categoryModels: {},
      categoryVariants: {},
      roleModels: {},
      maxFallbacks: 3,
      allowedProviders: [],
      deniedModels: [],
    },
    parallel: { enabled: true, max: 3, providers: {}, models: {} },
    teamMode: { enabled: false, auto: false, maxMembers: 4, maxMessages: 24, maxTurns: 12, maxWallMinutes: 45 },
  }
}

test('doctor routing-config check is present and surface the roleModels file', () => {
  const project = makeProject()
  try {
    writeProjectRouting(project, {
      schema: 1,
      type: 'oho-routing',
      routing: {
        strategy: 'quality',
        roleModels: {
          coder: ['opencode-go/minimax-m3'],
          'security-reviewer': ['opencode-go/minimax-m3-high'],
          'qa-reviewer': ['opencode-go/minimax-m3'],
          architect: ['opencode-go/minimax-m3'],
          'repository-explorer': ['opencode-go/minimax-m3'],
        },
      },
    })
    const cfg = defaultHhcConfig()
    const checks = runDoctor(cfg, new MissionStore(), project, { models: [] })
    const r = checks.find(c => c.id === 'routing-config')
    assert.ok(r, 'routing-config check must be present in 2.0.3+')
    assert.equal(r.status, 'pass', 'valid schema 1 with 5 roles must pass')
    assert.match(r.detail, /strategy=quality/)
    assert.match(r.detail, /roles=coder,security-reviewer,qa-reviewer,architect,repository-explorer/)
  } finally { rmSync(project, { recursive: true, force: true }) }
})

test('doctor routing-config: no file yields info (not warn)', () => {
  const project = makeProject()
  try {
    const cfg = defaultHhcConfig()
    const checks = runDoctor(cfg, new MissionStore(), project, { models: [] })
    const r = checks.find(c => c.id === 'routing-config')
    assert.ok(r)
    assert.equal(r.status, 'info')
    assert.match(r.detail, /no \.opencode\/oho-routing\.json/)
    assert.match(r.detail, /scoring fallback/)
  } finally { rmSync(project, { recursive: true, force: true }) }
})

test('doctor routing-config: bad schema yields warn', () => {
  const project = makeProject()
  try {
    writeProjectRouting(project, { schema: 99, type: 'wrong', routing: { roleModels: { coder: ['x'] } } })
    const cfg = defaultHhcConfig()
    const checks = runDoctor(cfg, new MissionStore(), project, { models: [] })
    const r = checks.find(c => c.id === 'routing-config')
    assert.equal(r.status, 'warn')
    assert.match(r.detail, /schema=99/)
  } finally { rmSync(project, { recursive: true, force: true }) }
})

test('doctor formatDoctor includes routing-config line', () => {
  const project = makeProject()
  try {
    writeProjectRouting(project, {
      schema: 1,
      type: 'oho-routing',
      routing: { roleModels: { coder: ['opencode-go/minimax-m3'] } },
    })
    const out = formatDoctor(runDoctor(defaultHhcConfig(), new MissionStore(), project, { models: [] }))
    assert.match(out, /PASS routing-config:.*coder/)
  } finally { rmSync(project, { recursive: true, force: true }) }
})
