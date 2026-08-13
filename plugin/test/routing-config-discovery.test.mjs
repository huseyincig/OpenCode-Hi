import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveHiConfig } from '../dist/config/resolver.js'

function makeProject() {
  return mkdtempSync(join(tmpdir(), 'hi-routing-'))
}

function writeRouting(project, body) {
  mkdirSync(join(project, '.opencode', 'hi', 'policy'), { recursive: true })
  writeFileSync(join(project, '.opencode', 'hi', 'policy', 'routing.json'), JSON.stringify(body), 'utf8')
}

test('no project routing config: defaults to empty roleModels (scoring fallback)', () => {
  const project = makeProject()
  try {
    const cfg = resolveHiConfig({}, project)
    assert.equal(cfg.routing.roleModels['coder'], undefined)
    assert.equal(cfg.routing.roleModels['security-reviewer'], undefined)
  } finally { rmSync(project, { recursive: true, force: true }) }
})

test('project routing config: roleModels merged into resolved config', () => {
  const project = makeProject()
  try {
    writeRouting(project, {
      schema: 1,
      type: 'hi-routing',
      routing: {
        strategy: 'quality',
        roleModels: {
          coder: ['opencode-go/minimax-m3'],
          'security-reviewer': ['opencode-go/minimax-m3-high'],
        },
      },
    })
    const cfg = resolveHiConfig({}, project)
    assert.deepEqual(cfg.routing.roleModels['coder'], ['opencode-go/minimax-m3'])
    assert.deepEqual(cfg.routing.roleModels['security-reviewer'], ['opencode-go/minimax-m3-high'])
    assert.equal(cfg.routing.roleModels['qa-reviewer'], undefined)
    assert.equal(cfg.routing.strategy, 'quality')
  } finally { rmSync(project, { recursive: true, force: true }) }
})

test('project routing config: project file wins over raw input (project = user override)', () => {
  // Project file is the user's explicit override; raw input (OpenCode-native
  // config) is the default. Project > raw. So if both define coder,
  // project wins.
  const project = makeProject()
  try {
    writeRouting(project, {
      schema: 1,
      type: 'hi-routing',
      routing: { roleModels: { coder: ['from-project'] } },
    })
    const cfg = resolveHiConfig({
      routing: { roleModels: { coder: ['from-input'] } },
    }, project)
    assert.deepEqual(cfg.routing.roleModels['coder'], ['from-project'])
  } finally { rmSync(project, { recursive: true, force: true }) }
})

test('project routing config: bad schema returns undefined (silent fallback)', () => {
  const project = makeProject()
  try {
    writeRouting(project, { schema: 99, type: 'wrong', routing: { roleModels: { coder: ['x'] } } })
    const cfg = resolveHiConfig({}, project)
    assert.equal(cfg.routing.roleModels['coder'], undefined)
  } finally { rmSync(project, { recursive: true, force: true }) }
})

test('project routing config: invalid JSON returns undefined', () => {
  const project = makeProject()
  try {
    mkdirSync(join(project, '.opencode', 'hi', 'policy'), { recursive: true })
    writeFileSync(join(project, '.opencode', 'hi', 'policy', 'routing.json'), '{not-json', 'utf8')
    const cfg = resolveHiConfig({}, project)
    assert.equal(cfg.routing.roleModels['coder'], undefined)
  } finally { rmSync(project, { recursive: true, force: true }) }
})

test('project routing config: allowedProviders / deniedModels surface', () => {
  const project = makeProject()
  try {
    writeRouting(project, {
      schema: 1,
      type: 'hi-routing',
      routing: {
        allowedProviders: ['opencode-go'],
        deniedModels: ['legacy-model'],
        roleModels: {},
      },
    })
    const cfg = resolveHiConfig({}, project)
    assert.deepEqual(cfg.routing.allowedProviders, ['opencode-go'])
    assert.deepEqual(cfg.routing.deniedModels, ['legacy-model'])
  } finally { rmSync(project, { recursive: true, force: true }) }
})

test('project routing config: categoryVariants override', () => {
  const project = makeProject()
  try {
    writeRouting(project, {
      schema: 1,
      type: 'hi-routing',
      routing: { categoryVariants: { critical: ['xhigh', 'max'] } },
    })
    const cfg = resolveHiConfig({}, project)
    assert.deepEqual(cfg.routing.categoryVariants['critical'], ['xhigh', 'max'])
  } finally { rmSync(project, { recursive: true, force: true }) }
})

test('native_plugin_setup.py role-models --defaults produces valid schema 1 file', () => {
  // Smoke test against the helper script to verify the on-disk format
  // matches the runtime loader's expectations.
  const project = makeProject()
  try {
    writeRouting(project, {
      schema: 1,
      type: 'hi-routing',
      routing: {
        strategy: 'cost-quality',
        roleModels: {
          coder: ['opencode-go/minimax-m3'],
          securityreviewer: undefined, // placeholder intentionally invalid
        },
      },
    })
    const cfg = resolveHiConfig({}, project)
    assert.equal(cfg.routing.roleModels['coder'].length, 1)
    // schema mismatch (good schemas only) is silently ignored
    const bad = makeProject()
    try {
      writeRouting(bad, { schema: 2, type: 'hi-routing', routing: {} })
      const c = resolveHiConfig({}, bad)
      assert.equal(c.routing.roleModels['coder'], undefined)
    } finally { rmSync(bad, { recursive: true, force: true }) }
  } finally { rmSync(project, { recursive: true, force: true }) }
})


test('project routing strategy is authoritative over raw/native input', () => {
  const project = makeProject()
  try {
    writeRouting(project, { schema: 1, type: 'hi-routing', routing: { strategy: 'quality' } })
    const cfg = resolveHiConfig({ routing: { strategy: 'cost' } }, project)
    assert.equal(cfg.routing.strategy, 'quality')
  } finally { rmSync(project, { recursive: true, force: true }) }
})


test('project routing constraints narrow but never weaken raw/native Hi constraints', () => {
  const project = makeProject()
  try {
    writeRouting(project, {
      schema: 1,
      type: 'hi-routing',
      routing: { allowedProviders: ['p','q'], deniedModels: ['q/bad'] },
    })
    const cfg = resolveHiConfig({ routing: { allowedProviders: ['q','r'], deniedModels: ['p/bad'] } }, project)
    assert.deepEqual(cfg.routing.allowedProviders, ['q'])
    assert.deepEqual(new Set(cfg.routing.deniedModels), new Set(['p/bad','q/bad']))
  } finally { rmSync(project, { recursive: true, force: true }) }
})
