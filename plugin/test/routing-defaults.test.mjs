// Default roleModels regression guard (2.0.10).
// Verifies that auto-init writes the correct default per-role map
// when `.opencode/hi/policy/routing.json` does not yet exist.

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ensureProjectRoutingConfig, DEFAULT_ROLE_MODELS_OPENCODE_GO } from '../dist/config/auto-init.js'

function makeProject() {
  return mkdtempSync(join(tmpdir(), 'hi-routing-defaults-'))
}

test('default roleModels contains the new per-role map (2.0.10)', () => {
  // All canonical roles have a curated recommendation. Runtime auto-init
  // still validates these IDs against the live OpenCode inventory before persisting.
  assert.deepEqual(DEFAULT_ROLE_MODELS_OPENCODE_GO, {
    'working-manager': ['opencode-go/mimo-v2.5','opencode-go/deepseek-v4-flash','opencode-go/qwen3.7-plus','opencode-go/mimo-v2.5-pro'],
    manager: ['opencode-go/mimo-v2.5','opencode-go/qwen3.7-plus','opencode-go/minimax-m2.7','opencode-go/mimo-v2.5-pro'],
    coder: ['opencode-go/deepseek-v4-flash','opencode-go/mimo-v2.5','opencode-go/qwen3.7-plus','opencode-go/mimo-v2.5-pro'],
    'security-reviewer': ['opencode-go/mimo-v2.5-pro','opencode-go/qwen3.6-plus','opencode-go/hy3'],
    'qa-reviewer': ['opencode-go/hy3','opencode-go/qwen3.6-plus','opencode-go/mimo-v2.5-pro'],
    architect: ['opencode-go/qwen3.7-plus','opencode-go/minimax-m2.7','opencode-go/mimo-v2.5-pro'],
    'visual-qa': ['opencode-go/hy3','opencode-go/mimo-v2.5','opencode-go/qwen3.6-plus'],
    'repository-explorer': ['opencode-go/mimo-v2.5','opencode-go/deepseek-v4-flash','opencode-go/qwen3.7-plus'],
  })
})

test('ensureProjectRoutingConfig writes the default file when missing', () => {
  const project = makeProject()
  try {
    const result = ensureProjectRoutingConfig(project)
    assert.equal(result.created, true)
    assert.equal(result.path, join(project, '.opencode', 'hi', 'policy', 'routing.json'))
    const content = JSON.parse(readFileSync(result.path, 'utf8'))
    assert.equal(content.schema, 1)
    assert.equal(content.type, 'hi-routing')
    assert.equal(content.routing.strategy, 'cost-quality')
    assert.deepEqual(content.routing.roleModels, DEFAULT_ROLE_MODELS_OPENCODE_GO)
    assert.equal(content.applied_by, 'opencode-hi')
  } finally { rmSync(project, { recursive: true, force: true }) }
})

test('ensureProjectRoutingConfig is idempotent on a second call', () => {
  const project = makeProject()
  try {
    const first = ensureProjectRoutingConfig(project)
    const second = ensureProjectRoutingConfig(project)
    assert.equal(first.created, true)
    assert.equal(second.created, false, 'second call must not overwrite')
  } finally { rmSync(project, { recursive: true, force: true }) }
})


test('inventory-aware auto-init persists only live curated recommendations', () => {
  const project = makeProject()
  try {
    const live=['opencode-go/mimo-v2.5','opencode-go/deepseek-v4-flash']
    const result=ensureProjectRoutingConfig(project,live)
    assert.equal(result.created,true)
    const content=JSON.parse(readFileSync(result.path,'utf8'))
    assert.deepEqual(content.routing.roleModels,{
      'working-manager':['opencode-go/mimo-v2.5','opencode-go/deepseek-v4-flash'],
      manager:['opencode-go/mimo-v2.5'],
      coder:['opencode-go/deepseek-v4-flash','opencode-go/mimo-v2.5'],
      'visual-qa':['opencode-go/mimo-v2.5'],
      'repository-explorer':['opencode-go/mimo-v2.5','opencode-go/deepseek-v4-flash'],
    })
  } finally { rmSync(project,{recursive:true,force:true}) }
})

test('inventory-aware auto-init does not persist unavailable model guesses', () => {
  const project=makeProject()
  try {
    const result=ensureProjectRoutingConfig(project,['other-provider/model-x'])
    assert.equal(result.created,false)
    assert.equal(result.reason,'runtime-inventory-has-no-curated-recommended-models')
    assert.equal(existsSync(result.path),false)
  } finally { rmSync(project,{recursive:true,force:true}) }
})
