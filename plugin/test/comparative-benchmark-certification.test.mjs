import test from 'node:test'
import assert from 'node:assert/strict'
import {COMPARATIVE_BENCHMARK_SCHEMA} from '../dist/contracts/comparative-benchmark.js'
import {buildComparativeBenchmarkCertificationSeries,isComparativeBenchmarkCertificationSeries} from '../dist/contracts/comparative-benchmark-certification.js'

const H='a'.repeat(64),S='b'.repeat(64),C='c'.repeat(40)
function receipt({episode='ep-1',repetition=1,episodeKind='REAL_HOST_EPISODE',result='VERIFIED_SUCCESS',check='PASS',fixture=H,config=H,model='p/m',opencode='1.18.20',hi=C}={}){
  return{schema:COMPARATIVE_BENCHMARK_SCHEMA,episode_kind:episodeKind,claim_boundary:'Bounded benchmark episode.',episode_id:episode,repetition,system:{kind:'OPENCODE_HI_CURRENT',label:'current-hi',opencode_version:opencode,hi_commit:hi,config_sha256:config},task:{task_id:'case-a',scenario_class:'failing-test-fix',fixture_sha256:fixture},model:{requested:model,effective:model,provider_effective:'p'},started_at:'2026-08-21T10:00:00.000Z',ended_at:'2026-08-21T10:00:01.000Z',deterministic_checks:[{id:'acceptance',status:check,exit_code:check==='PASS'?0:1,evidence_refs:check==='PASS'?['artifact:acceptance']:['artifact:failure']}],evidence:{required:1,satisfied:check==='PASS'?1:0,fresh:check==='PASS'?1:0,stale:0,wrong_task_accepted:0,wrong_attempt_accepted:0,false_completion:0},completion_decision:result==='VERIFIED_SUCCESS'?'DONE':'VERIFY',failure_injections:[],control_plane:{duplicate_dispatch_count:0,stale_callback_accept_count:0,ambiguous_side_effect_replay_count:0,deadlock_or_stall_count:0,orphan_or_cleanup_failure_count:0,workers_spawned:1,retries:0,replans:0,tool_calls:3,model_calls:1,polling_calls:0,peak_concurrent_workers:1,context_bytes_to_children:1000,mechanically_identified_redundant_actions:0},economics:{wall_time_ms:1000},artifacts:{receipt_inputs_sha256:S},result}
}
function sample(r,source=S,runtime={platform:'linux-x64',node_version:'22.0.0'}){return{receipt:r,environment:{source_inputs_sha256:source,...runtime}}}
function build(baseline,current){return buildComparativeBenchmarkCertificationSeries({series_id:'series-a',claim_boundary:'Certification aggregation only; exact episode receipts remain authoritative.',baseline:sample(baseline),current})}

test('real-host failure needs three stable samples before becoming a stable regression',()=>{
  const base=receipt(),f1=receipt({episode:'f1',repetition:1,result:'VERIFIED_FAILURE',check:'FAIL'})
  const one=build(base,[sample(f1)]);assert.equal(one.verdict,'INCONCLUSIVE');assert.equal(one.stability.required_samples,3);assert.equal(one.stability.observed_samples,1)
  const three=build(base,[1,2,3].map(i=>sample(receipt({episode:`f${i}`,repetition:i,result:'VERIFIED_FAILURE',check:'FAIL'}))))
  assert.equal(three.verdict,'STABLE_REGRESSION');assert.equal(three.stability.stable,true);assert.equal(three.stability.outcome_hashes.length,3);assert.equal(isComparativeBenchmarkCertificationSeries(three),true)
})

test('mixed three-sample real-host outcomes are first-class flaky, not a regression attribution',()=>{
  const base=receipt(),current=[sample(receipt({episode:'f1',repetition:1,result:'VERIFIED_FAILURE',check:'FAIL'})),sample(receipt({episode:'p2',repetition:2})),sample(receipt({episode:'f3',repetition:3,result:'VERIFIED_FAILURE',check:'FAIL'}))]
  const series=build(base,current);assert.equal(series.verdict,'FLAKY');assert.equal(series.stability.stable,false);assert.equal(series.attribution.reliable,false)
})

test('deterministic fixture failure does not pay a pointless three-sample tax',()=>{
  const base=receipt({episodeKind:'DETERMINISTIC_FIXTURE'}),fail=receipt({episode:'d2',episodeKind:'DETERMINISTIC_FIXTURE',result:'VERIFIED_FAILURE',check:'FAIL'})
  const series=build(base,[sample(fail)]);assert.equal(series.verdict,'STABLE_REGRESSION');assert.equal(series.stability.required_samples,1);assert.equal(series.stability.performed,false)
})

test('stable failure attributes one exact source-input delta reliably',()=>{
  const base=receipt(),current=[1,2,3].map(i=>sample(receipt({episode:`f${i}`,repetition:i,result:'VERIFIED_FAILURE',check:'FAIL'}),'d'.repeat(64)))
  const series=build(base,current);assert.equal(series.verdict,'STABLE_REGRESSION');assert.equal(series.attribution.top,'SOURCE_CHANGED');assert.deepEqual(series.attribution.also_observed,[]);assert.equal(series.attribution.reliable,true);assert.deepEqual(series.environment_delta.keys_changed,['source_inputs_sha256'])
})

test('multiple environment classes never masquerade as a singular causal attribution',()=>{
  const base=receipt(),current=[1,2,3].map(i=>sample(receipt({episode:`f${i}`,repetition:i,result:'VERIFIED_FAILURE',check:'FAIL',fixture:'d'.repeat(64)}),'e'.repeat(64)))
  const series=build(base,current);assert.equal(series.attribution.top,'SOURCE_CHANGED');assert.deepEqual(series.attribution.also_observed,['FIXTURE_CHANGED']);assert.equal(series.attribution.reliable,false);assert.match(series.attribution.reason,/multiple environment classes/i)
})

test('environment drift between stability samples makes the series inconclusive even when failure shape matches',()=>{
  const base=receipt(),current=[sample(receipt({episode:'f1',repetition:1,result:'VERIFIED_FAILURE',check:'FAIL'}),'d'.repeat(64)),sample(receipt({episode:'f2',repetition:2,result:'VERIFIED_FAILURE',check:'FAIL'}),'e'.repeat(64)),sample(receipt({episode:'f3',repetition:3,result:'VERIFIED_FAILURE',check:'FAIL'}),'d'.repeat(64))]
  const series=build(base,current);assert.equal(series.verdict,'INCONCLUSIVE');assert.equal(series.environment_stable,false);assert.equal(series.attribution.reliable,false)
})

test('stable unexplained failure is UNKNOWN_DRIFT rather than fabricated model or source blame',()=>{
  const base=receipt(),current=[1,2,3].map(i=>sample(receipt({episode:`f${i}`,repetition:i,result:'VERIFIED_FAILURE',check:'FAIL'})))
  const series=build(base,current);assert.equal(series.attribution.top,'UNKNOWN_DRIFT');assert.equal(series.attribution.reliable,true)
})

test('BLOCKED_ENVIRONMENT remains a separate certification result and is never called regression',()=>{
  const base=receipt(),current=[sample(receipt({episode:'b1',result:'BLOCKED_ENVIRONMENT',check:'NOT_RUN'}))]
  current[0].receipt.deterministic_checks[0]={id:'acceptance',status:'NOT_RUN',evidence_refs:[],detail:'host unavailable'}
  current[0].receipt.evidence={required:1,satisfied:0,fresh:0,stale:0,wrong_task_accepted:0,wrong_attempt_accepted:0,false_completion:0}
  const series=build(base,current);assert.equal(series.verdict,'BLOCKED_ENVIRONMENT');assert.equal(series.attribution.reliable,false)
})

test('series rejects malformed environment hashes duplicate repetitions and unknown fields',()=>{
  const base=receipt(),fail=receipt({episode:'f1',result:'VERIFIED_FAILURE',check:'FAIL'})
  assert.throws(()=>buildComparativeBenchmarkCertificationSeries({series_id:'series-a',claim_boundary:'certification only',baseline:sample(base,'bad'),current:[sample(fail)]}),/source_inputs_sha256/i)
  const dup=[sample(receipt({episode:'f1',repetition:1,result:'VERIFIED_FAILURE',check:'FAIL'})),sample(receipt({episode:'f2',repetition:1,result:'VERIFIED_FAILURE',check:'FAIL'})),sample(receipt({episode:'f3',repetition:3,result:'VERIFIED_FAILURE',check:'FAIL'}))]
  assert.throws(()=>build(base,dup),/repetition/i)
  const valid=build(base,[sample(receipt({episode:'p2'}))]);assert.equal(isComparativeBenchmarkCertificationSeries({...valid,magic:true}),false)
})


test('uncertainty diagnostics add CI judge agreement and explicit evidence diversity without changing exact verdict authority',()=>{
  const base=receipt(),current=[1,2,3].map((i)=>{const r=receipt({episode:`p${i}`,repetition:i});r.economics.wall_time_ms=[900,1000,1100][i-1];return sample(r)})
  const plain=build(base,current)
  const judged=buildComparativeBenchmarkCertificationSeries({series_id:'series-a',claim_boundary:'Certification aggregation only; exact episode receipts remain authoritative.',baseline:sample(base),current,judge_scores:[[1,1,0],[0,1,0],[1,0,1]],evidence_families:['runtime','runtime','git','browser']})
  assert.equal(judged.verdict,plain.verdict);assert.equal(judged.verdict,'NO_REGRESSION')
  assert.equal(judged.uncertainty.advisory_only,true);assert.equal(judged.uncertainty.wall_time_ms.sample_count,3);assert.equal(judged.uncertainty.wall_time_ms.mean,1000)
  assert.equal(judged.uncertainty.judge_agreement.status,'MEASURED');assert.ok(judged.uncertainty.flags.includes('JUDGE_DISAGREEMENT'))
  assert.equal(judged.uncertainty.evidence_family_diversity.unique_family_count,3)
  assert.equal(isComparativeBenchmarkCertificationSeries(judged),true)
})

test('judge consensus cannot convert deterministic receipt failure or success into a different certification verdict',()=>{
  const base=receipt(),fail=[1,2,3].map(i=>sample(receipt({episode:`f${i}`,repetition:i,result:'VERIFIED_FAILURE',check:'FAIL'})))
  const allPassJudges=buildComparativeBenchmarkCertificationSeries({series_id:'series-a',claim_boundary:'Certification aggregation only; exact episode receipts remain authoritative.',baseline:sample(base),current:fail,judge_scores:[[1,1,1],[1,1,1]],evidence_families:['judge','judge']})
  assert.equal(allPassJudges.uncertainty.judge_agreement.fleiss_kappa,1);assert.equal(allPassJudges.verdict,'STABLE_REGRESSION')
  const success=[1,2,3].map(i=>sample(receipt({episode:`s${i}`,repetition:i})))
  const allFailJudges=buildComparativeBenchmarkCertificationSeries({series_id:'series-b',claim_boundary:'Certification aggregation only; exact episode receipts remain authoritative.',baseline:sample(base),current:success,judge_scores:[[0,0,0],[0,0,0]],evidence_families:['judge','judge']})
  assert.equal(allFailJudges.uncertainty.judge_agreement.fleiss_kappa,1);assert.equal(allFailJudges.verdict,'NO_REGRESSION')
})

test('legacy schema-1 series without uncertainty remains validator-compatible',()=>{
  const built=build(receipt(),[sample(receipt({episode:'p2'}))]),legacy={...built};delete legacy.uncertainty
  assert.equal(isComparativeBenchmarkCertificationSeries(legacy),true)
})
