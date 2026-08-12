import test from 'node:test'
import assert from 'node:assert/strict'
import { runDeterministicBenchmarks } from '../dist/runtime/telemetry/benchmarks.js'

test('0.1.0 benchmark set covers every required representative scenario without pretending to be host telemetry',()=>{
  const rows=runDeterministicBenchmarks();assert.equal(rows.length,9)
  assert.deepEqual(new Set(rows.map(x=>x.id)),new Set(['simple-local-task','unknown-repository-convention','complex-cross-module-task','failed-verification','long-session','human-gated-task','long-running-process','multi-model-task','multi-agent-task']))
  for(const r of rows){assert.equal(r.kind,'DETERMINISTIC_POLICY_SIMULATION');assert.match(r.claimBoundary,/not a provider latency\/token-price or external OpenCode runtime measurement/)}
})

test('minimum-sufficient scenarios reduce waste while multi-agent fan-out remains benefit-gated',()=>{
  const by=Object.fromEntries(runDeterministicBenchmarks().map(x=>[x.id,x]))
  for(const id of ['simple-local-task','unknown-repository-convention','failed-verification','long-session','human-gated-task','long-running-process','multi-model-task']){
    assert.ok(by[id].after.totalActions<=by[id].before.totalActions,id)
    assert.ok(by[id].deltas.wastedComputeRatio<=0,id)
  }
  assert.equal(by['simple-local-task'].after.agentCount,1)
  assert.ok(by['long-session'].after.contextChars<by['long-session'].before.contextChars)
  assert.ok(by['multi-agent-task'].after.agentCount>1)
  assert.ok(by['multi-agent-task'].after.elapsedUnits<by['multi-agent-task'].before.elapsedUnits)
})
