import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { observeToolAfter, addEvidence } from '../dist/runtime/evidence/evidence-runtime.js'
import { verificationSatisfied, latestBlockingVerificationEvidence } from '../dist/runtime/verification/policy.js'
import { evaluateIdle } from '../dist/runtime/continuation/evaluator.js'
import {startAssessedMission} from './helpers/semantic.mjs'

function mission(){
  const s=new MissionStore(process.cwd())
  const m=startAssessedMission(s,`s-${Math.random()}`,'opaque bug',{task_kind:'bug-fix',likely_verification:['targeted-tests']})
  m.evidence.last_mutation_at=Date.now()-10
  return m
}

test('structured nonzero verifier exit is FAILED even when stdout looks benign',()=>{
  const m=mission()
  observeToolAfter(m,'bash',{command:'npm test'},{output:'Test run completed',metadata:{exit:1}})
  const e=m.evidence.items.at(-1)
  assert.equal(e.outcome,'failed')
  assert.equal(e.pass,false)
  assert.equal(e.reason,'verification-exit-1')
  assert.equal(verificationSatisfied(m).ok,false)
})

test('missing verifier/toolchain is environment-issue, not product test failure',()=>{
  const m=mission()
  m.stagnation_count=4
  observeToolAfter(m,'bash',{command:'npm test'},{output:'sh: vitest: command not found',metadata:{exit:127}})
  const e=m.evidence.items.at(-1)
  assert.equal(e.outcome,'environment-issue')
  assert.equal(e.pass,undefined)
  const decision=evaluateIdle(m)
  assert.equal(decision.reason_code,'verification-environment-issue')
  assert.equal(decision.decision,'RECOVER')
  assert.equal(m.stagnation_count,0)
  assert.match(decision.prompt,/do not modify product code merely to make an unavailable verifier run/i)
})

test('unstructured verification output with no exit signal is pending, never implicit PASS',()=>{
  const m=mission()
  observeToolAfter(m,'bash',{command:'npm test'},'all done')
  const e=m.evidence.items.at(-1)
  assert.equal(e.outcome,'pending')
  assert.equal(e.pass,undefined)
  assert.equal(m.evidence.fresh,false)
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
