import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { observeToolAfter, addEvidence, markMutation, isVerificationCommand } from '../dist/runtime/evidence/evidence-runtime.js'
import { verificationSatisfied, latestBlockingVerificationEvidence } from '../dist/runtime/verification/policy.js'
import { evaluateIdle } from '../dist/runtime/continuation/evaluator.js'
import {startAssessedMission} from './helpers/semantic.mjs'

function mission(){
  const s=new MissionStore(process.cwd())
  const m=startAssessedMission(s,`s-${Math.random()}`,'opaque bug',{task_kind:'bug-fix',likely_verification:['targeted-tests']})
  m.execution.evidence.last_mutation_at=Date.now()-10
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation');if(implementation){implementation.status='closed';implementation.closedAt=Date.now()}
  return m
}

test('verification classifier requires an executable verifier invocation, not a path or prose substring',()=>{
  assert.equal(isVerificationCommand('ls -la src test && git diff opencode.json'),false)
  assert.equal(isVerificationCommand('git diff --name-only test/'),false)
  assert.equal(isVerificationCommand('echo test'),false)
  assert.equal(isVerificationCommand('node --test test/alpha.test.js test/beta.test.js'),true)
  assert.equal(isVerificationCommand('npm test 2>&1 | tail -20'),true)
  assert.equal(isVerificationCommand('cd plugin && npm run build'),true)
  assert.equal(isVerificationCommand('pnpm run typecheck'),true)
})

test('non-verifier command containing a test path records no verification evidence',()=>{
  const m=mission(),before=m.execution.evidence.items.length
  observeToolAfter(m,'bash',{command:'ls -la src test && git diff opencode.json'},{stdout:'src test',metadata:{exit:0}})
  assert.equal(m.execution.evidence.items.length,before)
})

test('mutation reopens a closed verification claim and fresh verifier evidence closes it again',()=>{
  const m=mission(),verification=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(verification)
  observeToolAfter(m,'bash',{command:'npm test'},{stdout:'pass',metadata:{exit:0}})
  assert.equal(verification.status,'closed');const first=m.execution.evidence.items.at(-1);assert.ok(first?.obligation_ids?.includes(verification.id));assert.equal(first.invalidated_at,undefined)
  markMutation(m,['src/a.ts'],'edit')
  assert.equal(verification.status,'open');assert.ok(first.invalidated_at);assert.ok(m.execution.ledger.some(e=>e.type==='obligation.reopened'&&e.payload?.obligation===verification.id))
  observeToolAfter(m,'bash',{command:'node --test test/a.test.js'},{stdout:'pass',metadata:{exit:0}})
  const fresh=m.execution.evidence.items.at(-1);assert.equal(fresh.kind,'targeted-tests');assert.ok(fresh.obligation_ids?.includes(verification.id));assert.equal(fresh.invalidated_at,undefined);assert.equal(verification.status,'closed');assert.equal(verificationSatisfied(m,verification.id).ok,true)
})

test('fresh verification wins when invalidated and replacement evidence share the same timestamp',()=>{
  const m=mission(),verification=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(verification)
  const at=Date.now()
  const stale=addEvidence(m,{kind:'targeted-tests',summary:'old pass',scope:['src/a.ts'],source:'bash',obligation_ids:[verification.id],pass:true,outcome:'passed',observed_at:at})
  stale.invalidated_at=at
  addEvidence(m,{kind:'targeted-tests',summary:'fresh pass',scope:['src/a.ts'],source:'bash',obligation_ids:[verification.id],pass:true,outcome:'passed',observed_at:at})
  assert.equal(verificationSatisfied(m,verification.id).ok,true)
})

test('structured nonzero verifier exit is FAILED even when stdout looks benign',()=>{
  const m=mission()
  observeToolAfter(m,'bash',{command:'npm test'},{output:'Test run completed',metadata:{exit:1}})
  const e=m.execution.evidence.items.at(-1)
  assert.equal(e.outcome,'failed')
  assert.equal(e.pass,false)
  assert.equal(e.reason,'verification-exit-1')
  assert.equal(verificationSatisfied(m).ok,false)
})

test('missing verifier/toolchain is environment-issue, not product test failure',()=>{
  const m=mission()
  m.continuation.stagnation_count=4
  observeToolAfter(m,'bash',{command:'npm test'},{output:'sh: vitest: command not found',metadata:{exit:127}})
  const e=m.execution.evidence.items.at(-1)
  assert.equal(e.outcome,'environment-issue')
  assert.equal(e.pass,undefined)
  const decision=evaluateIdle(m)
  assert.equal(decision.reason_code,'verification-environment-issue')
  assert.equal(decision.decision,'USER_ACTION_REQUIRED')
  assert.equal(m.continuation.stagnation_count,0)
  assert.equal(decision.prompt,undefined)
})

test('unstructured verification output with no exit signal is pending, never implicit PASS',()=>{
  const m=mission()
  observeToolAfter(m,'bash',{command:'npm test'},'all done')
  const e=m.execution.evidence.items.at(-1)
  assert.equal(e.outcome,'pending')
  assert.equal(e.pass,undefined)
  assert.equal(m.execution.evidence.fresh,false)
  assert.equal(verificationSatisfied(m).ok,false)
})

test('required test environment issue is not hidden by a later unrelated lint PASS',()=>{
  const m=mission()
  const base=Date.now()
  addEvidence(m,{kind:'targeted-tests',summary:'vitest unavailable',scope:[],source:'bash',outcome:'environment-issue',reason:'verification-environment-unavailable',observed_at:base})
  addEvidence(m,{kind:'lint',summary:'eslint',scope:[],source:'bash',pass:true,outcome:'passed',observed_at:base+1})
  const blocking=latestBlockingVerificationEvidence(m)
  assert.equal(blocking?.kind,'targeted-tests')
  assert.equal(evaluateIdle(m).reason_code,'verification-environment-issue')
})
