import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveCategory } from '../dist/runtime/routing/category.js'
import { resolveExecutionMode } from '../dist/runtime/routing/execution-mode.js'
import { minimumTeamFor } from '../dist/runtime/routing/minimum-team.js'
import { decideTopology } from '../dist/runtime/execution/topology-policy.js'
import { verificationPolicyFor } from '../dist/runtime/verification/policy.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { evaluateIdle, shouldCountStagnation } from '../dist/runtime/continuation/evaluator.js'
import { builtinMethodologyCatalog, methodologiesForSignal } from '../dist/runtime/methodology/catalog.js'
import { resolveSkillPlan } from '../dist/runtime/skills/registry.js'
import { resolveHiConfig } from '../dist/config/resolver.js'
import { resolveModel } from '../dist/runtime/routing/model-resolver.js'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const corpusRoot = resolve(repoRoot, 'data/validation/decision-replay')

function exactKeys(value, expected, where) {
  assert.equal(value !== null && typeof value === 'object' && !Array.isArray(value), true, `${where} must be an object`)
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${where} shape drift`)
}

function readJsonl(name, topKeys, nestedValidators = []) {
  const file = resolve(corpusRoot, name)
  const lines = readFileSync(file, 'utf8').trimEnd().split('\n')
  assert.ok(lines.length > 0, `${name} is empty`)
  const ids = new Set()
  return lines.map((line, index) => {
    assert.notEqual(line.trim(), '', `${name}:${index + 1} blank line`)
    const row = JSON.parse(line)
    exactKeys(row, topKeys, `${name}:${index + 1}`)
    assert.match(row.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${name}:${index + 1} non-portable id`)
    assert.equal(ids.has(row.id), false, `${name}:${index + 1} duplicate id ${row.id}`)
    ids.add(row.id)
    for (const validate of nestedValidators) validate(row, `${name}:${index + 1}`)
    return row
  })
}

const intentKeys = ['objective','likelyTargets','taskKind','scope','risk','ambiguity','dependencyClass','requiredCapabilities','requestedExternalActions','likelyVerification','avoid']
const routingExpectedKeys = ['category','execution_mode','primary_role','direct','roles','topology','agent_count','parallelism','require_review']
const continuationStateKeys = ['kind','pending_permissions','worker_status','blockers','user_interrupted','continuation_failures']
const continuationExpectedKeys = ['decision','reason_code','count_stagnation']
const methodologyExpectedKeys = ['activated','selected','outcomes']
const modelExpectedKeys = ['primary','variant','fallbacks','rejected']

function normalizedAssessmentFromIntent(intent) {
  return {
    material: true,
    message_kind: 'mission',
    task_kind: intent.taskKind,
    scope: intent.scope,
    risk: intent.risk,
    ambiguity: intent.ambiguity,
    dependency_class: intent.dependencyClass,
    required_capabilities: [...intent.requiredCapabilities],
    requested_external_actions: [...intent.requestedExternalActions],
    likely_verification: [...intent.likelyVerification],
    likely_targets: [...(intent.likelyTargets ?? [])],
    intent_signals: [],
    suppressed_intent_signals: [],
  }
}

test('Q1 semantic routing replay corpus is closed-shape and matches canonical routing owners', () => {
  const rows = readJsonl('semantic-routing.jsonl', ['id','intent','expected'], [
    (row, where) => { exactKeys(row.intent, intentKeys, `${where}.intent`); exactKeys(row.expected, routingExpectedKeys, `${where}.expected`) },
  ])
  for (const row of rows) {
    const category = resolveCategory(row.intent)
    const mode = resolveExecutionMode(row.intent)
    const policy = verificationPolicyFor(row.intent)
    const team = minimumTeamFor(row.intent, policy)
    const topology = decideTopology(row.intent)
    assert.deepEqual({
      category,
      execution_mode: mode.mode,
      primary_role: team.primary,
      direct: team.direct,
      roles: team.roles,
      topology: topology.mode,
      agent_count: topology.agentCount,
      parallelism: topology.parallelism,
      require_review: policy.requireReview,
    }, row.expected, row.id)
  }
})

function buildContinuationState(row) {
  if (row.state.kind === 'none') return undefined
  const store = new MissionStore(process.cwd())
  const mission = store.start(row.id, 'opaque replay continuation')
  store.applyInitialSemanticAssessment(row.id, normalizedAssessmentFromIntent({
    objective: 'opaque replay continuation', likelyTargets: [], taskKind: 'implementation', scope: 'local', risk: 'low', ambiguity: 'none', dependencyClass: 'independent', requiredCapabilities: ['implementation'], requestedExternalActions: [], likelyVerification: [], avoid: [],
  }))
  mission.continuation.user_interrupted = row.state.user_interrupted
  mission.authority.pending_permissions = row.state.pending_permissions
  mission.continuation.continuation_failure_count = row.state.continuation_failures
  mission.execution.blockers = [...row.state.blockers]
  if (row.state.worker_status !== 'none') {
    mission.execution.workers.push({
      id: `worker-${row.id}`, task_id: `task-${row.id}`, role: 'coder', category: 'standard', parent_session_id: row.id,
      parent_mission_id: mission.identity.mission_id, fallbacks: [], selected_methodologies: [], loaded_methodologies: [], methodologies: [],
      fingerprint: row.id, status: row.state.worker_status, generation_at_spawn: mission.continuation.generation,
    })
  }
  return mission
}

test('Q1 continuation replay corpus is closed-shape and matches canonical idle decisions', () => {
  const rows = readJsonl('continuation.jsonl', ['id','state','expected'], [
    (row, where) => { exactKeys(row.state, continuationStateKeys, `${where}.state`); exactKeys(row.expected, continuationExpectedKeys, `${where}.expected`) },
  ])
  for (const row of rows) {
    const decision = evaluateIdle(buildContinuationState(row), Date.now() + 10_000)
    assert.deepEqual({decision: decision.decision, reason_code: decision.reason_code, count_stagnation: shouldCountStagnation(decision)}, row.expected, row.id)
  }
})

test('Q1 methodology replay corpus is closed-shape and exercises catalog plus executable skill preflight', () => {
  const catalog = builtinMethodologyCatalog()
  const rows = readJsonl('methodology-selection.jsonl', ['id','signal','producer','role','available_resources','permission','expected'], [
    (row, where) => exactKeys(row.expected, methodologyExpectedKeys, `${where}.expected`),
  ])
  for (const row of rows) {
    const activated = methodologiesForSignal(row.signal).map(item => item.name)
    const candidates = activated.map(name => {
      const policy = catalog.find(item => item.name === name)
      assert.ok(policy, `${row.id}: missing methodology policy ${name}`)
      return {name, provider: policy.provider, path: `/decision-replay/${name}/SKILL.md`, valid: true, enabled: true, orchestrationRisk: false}
    })
    const permissions = Object.fromEntries(activated.map(name => [name, row.permission]))
    const plan = resolveSkillPlan(activated, candidates, permissions, true, row.role, catalog, new Set(row.available_resources))
    assert.deepEqual({
      activated,
      selected: plan.selected.map(item => item.name),
      outcomes: plan.outcomes.map(item => `${item.name}:${item.outcome}`),
    }, row.expected, row.id)
  }
})

test('Q1 model replay corpus is closed-shape and matches canonical runtime model resolution', () => {
  const rows = readJsonl('model-routing.jsonl', ['id','category','role','available','config','explicit','host_config','feedback','expected'], [
    (row, where) => exactKeys(row.expected, modelExpectedKeys, `${where}.expected`),
  ])
  for (const row of rows) {
    const result = resolveModel(row.category, row.available, resolveHiConfig(row.config), row.explicit ?? undefined, row.role, row.host_config, row.feedback)
    assert.deepEqual({
      primary: result.primary ?? null,
      variant: result.primaryVariant ?? null,
      fallbacks: result.fallbacks,
      rejected: result.rejected.map(item => `${item.id}:${item.reason}`),
    }, row.expected, row.id)
  }
})

test('Q1 decision replay corpora are tests-only inputs, not runtime configuration', () => {
  for (const name of ['semantic-routing.jsonl','continuation.jsonl','methodology-selection.jsonl','model-routing.jsonl']) {
    const text = readFileSync(resolve(corpusRoot, name), 'utf8')
    assert.ok(text.endsWith('\n'), `${name} must end with newline`)
    assert.equal(text.includes('/workspace/'), false, `${name} must remain portable and contain no host path`)
  }
})
