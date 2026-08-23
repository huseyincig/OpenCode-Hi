import test from 'node:test'
import assert from 'node:assert/strict'
import {sampleDistribution95,fleissKappaBinary,evidenceFamilyDiversity,buildEvalUncertaintyDiagnostics} from '../dist/contracts/eval-uncertainty.js'

test('95 percent interval uses sample dispersion and t critical value for small n',()=>{
  const x=sampleDistribution95([100,120,140])
  assert.equal(x.sample_count,3);assert.equal(x.mean,120);assert.equal(x.sample_stddev,20)
  assert.ok(x.confidence_interval_95[0] < 80);assert.ok(x.confidence_interval_95[1] > 160)
  const one=sampleDistribution95([42]);assert.deepEqual(one.confidence_interval_95,[42,42])
})

test('Fleiss kappa is measured only for fixed-width binary multi-judge matrices',()=>{
  const perfect=fleissKappaBinary([[1,1,1],[0,0,0],[1,1,1]])
  assert.equal(perfect.status,'MEASURED');assert.equal(perfect.fleiss_kappa,1);assert.equal(perfect.band,'ALMOST_PERFECT')
  const mixed=fleissKappaBinary([[1,1,0],[0,1,0],[1,0,1]])
  assert.equal(mixed.status,'MEASURED');assert.ok(mixed.fleiss_kappa < .6)
  assert.equal(fleissKappaBinary([]).status,'NOT_PROVIDED')
  assert.equal(fleissKappaBinary([[1],[0]]).status,'INSUFFICIENT')
  assert.equal(fleissKappaBinary([[1,0],[1,2]]).status,'INSUFFICIENT')
})

test('evidence family diversity uses explicit labels only and exposes concentration',()=>{
  const x=evidenceFamilyDiversity(['runtime','runtime','git','browser'])
  assert.equal(x.status,'MEASURED');assert.equal(x.evidence_count,4);assert.equal(x.unique_family_count,3);assert.equal(x.largest_family_count,2);assert.equal(x.largest_family_share,.5)
  assert.deepEqual(x.families,{browser:1,git:1,runtime:2})
  assert.equal(evidenceFamilyDiversity([]).status,'NOT_PROVIDED')
  const one=buildEvalUncertaintyDiagnostics({wall_times_ms:[1],evidence_families:['runtime']});assert.ok(one.flags.includes('INSUFFICIENT_EVIDENCE_DIVERSITY'))
})

test('uncertainty flags disagreement and concentration but remains advisory only',()=>{
  const x=buildEvalUncertaintyDiagnostics({wall_times_ms:[100,110,90],judge_scores:[[1,1,0],[0,1,0],[1,0,1]],evidence_families:['same','same','same']})
  assert.equal(x.advisory_only,true);assert.ok(x.flags.includes('JUDGE_DISAGREEMENT'));assert.ok(x.flags.includes('LOW_EVIDENCE_FAMILY_DIVERSITY'))
})
