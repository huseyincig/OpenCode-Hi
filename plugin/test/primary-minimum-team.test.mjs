import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeIntent } from '../dist/runtime/intent/normalize.js'
import { verificationPolicyFor } from '../dist/runtime/verification/policy.js'
import { minimumTeamFor } from '../dist/runtime/routing/minimum-team.js'
import { routeCapabilities } from '../dist/runtime/routing/capability-router.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'

test('small local low-risk implementation uses Working Manager direct path with zero delegated workers',()=>{
  const intent=normalizeIntent('fix the README typo')
  const d=minimumTeamFor(intent,verificationPolicyFor(intent))
  assert.equal(d.primary,'working-manager')
  assert.equal(d.direct,true)
  assert.deepEqual(d.roles,[])
  const m=new MissionStore().start('s-direct','fix the README typo')
  assert.equal(m.primary_mode,'working-manager')
  assert.equal(m.workers.length,0)
})

test('security-sensitive implementation remains write-capable and adds independent security assurance',()=>{
  const intent=normalizeIntent('change auth token validation')
  const routed=routeCapabilities(intent)
  assert.equal(routed.role,'coder','read-only security reviewer must not own implementation')
  const d=minimumTeamFor(intent,verificationPolicyFor(intent))
  assert.equal(d.primary,'manager')
  assert.ok(d.roles.includes('coder'))
  assert.ok(d.roles.includes('security-reviewer'))
  assert.equal(d.roles.filter(x=>x==='security-reviewer').length,1)
})

test('deterministic low-risk evidence does not manufacture a QA reviewer',()=>{
  const intent=normalizeIntent('fix the typo in src/a.ts and test it')
  const policy=verificationPolicyFor(intent)
  assert.equal(policy.requireReview,false)
  const d=minimumTeamFor(intent,policy)
  assert.ok(!d.roles.includes('qa-reviewer'))
  assert.ok(d.reason.includes('deterministic-evidence-preferred')||d.direct)
})

test('review-dominant security work routes to read-only security reviewer',()=>{
  const intent=normalizeIntent('auth security review yap')
  assert.equal(intent.taskKind,'review')
  assert.equal(routeCapabilities(intent).role,'security-reviewer')
})


test('low-risk local inspect is direct evidence work, not an automatic independent reviewer agent',()=>{
  const intent=normalizeIntent('inspect opencode.json and report its schema value')
  const policy=verificationPolicyFor(intent)
  const d=minimumTeamFor(intent,policy)
  assert.equal(intent.taskKind,'review')
  assert.equal(policy.requireReview,false)
  assert.equal(d.primary,'working-manager')
  assert.equal(d.direct,true)
  assert.deepEqual(d.roles,[])
})

test('explicit independent review remains an independent reviewer decision',()=>{
  const intent=normalizeIntent('independent review of opencode.json')
  const policy=verificationPolicyFor(intent)
  const d=minimumTeamFor(intent,policy)
  assert.equal(policy.requireReview,true)
  assert.ok(intent.requiredCapabilities.includes('independent-review'))
  assert.ok(d.roles.includes('qa-reviewer'))
})
