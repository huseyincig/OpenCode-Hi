import test from 'node:test'
import assert from 'node:assert/strict'
import { runDeterministicBenchmarks,runSchedulerEconomicsBenchmarks,runRecoveryGovernorAblation } from '../dist/runtime/telemetry/benchmarks.js'

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


test('scheduler economics baseline measures every G9 dimension without claiming host latency',()=>{
  const rows=runSchedulerEconomicsBenchmarks()
  assert.deepEqual(rows.map(x=>x.id),['capacity-saturation','session-reuse','write-conflict'])
  for(const row of rows){assert.equal(row.kind,'DETERMINISTIC_SCHEDULER_SIMULATION');assert.match(row.claimBoundary,/not wall-clock provider latency/);for(const value of Object.values(row.metrics))assert.ok(Number.isFinite(value)&&value>=0)}
  const by=Object.fromEntries(rows.map(x=>[x.id,x]))
  assert.equal(by['capacity-saturation'].metrics.providerSaturationEvents,1)
  assert.equal(by['capacity-saturation'].metrics.modelSaturationEvents,1)
  assert.equal(by['capacity-saturation'].metrics.queueWaitUnits,2)
  assert.ok(by['capacity-saturation'].metrics.taskDurationUnits>0)
  assert.equal(by['session-reuse'].metrics.retries,1)
  assert.ok(by['session-reuse'].metrics.contextChars>0)
  assert.equal(by['session-reuse'].metrics.sessionReuseSavedUnits,2)
  assert.equal(by['write-conflict'].metrics.writeConflictEvents,1)
  assert.equal(by['write-conflict'].metrics.queueWaitUnits,1)
})


test('recovery ablation removes redundant same-state strategy replay without changing the fresh-state first action',()=>{
  const row=runRecoveryGovernorAblation()
  assert.equal(row.kind,'DETERMINISTIC_RECOVERY_ABLATION')
  assert.equal(row.baseline.redundantActions,1)
  assert.equal(row.governed.redundantActions,0)
  assert.equal(row.governed.first,'same-worker-resume')
  assert.equal(row.governed.second,'same-worker-resume')
  assert.ok(row.evidence.some(x=>x.includes('governed=1:same-worker-resume->2:same-worker-resume')))
  assert.equal(row.coveredCorrectnessPreserved,true)
  assert.match(row.claimBoundary,/not provider latency\/token billing/i)
})
