import test from 'node:test'
import assert from 'node:assert/strict'
import {COMPARATIVE_BENCHMARK_SCHEMA,isComparativeBenchmarkReceipt} from '../dist/contracts/comparative-benchmark.js'

const H='a'.repeat(64),C='b'.repeat(40)
function receipt(overrides={}){
  const base={schema:COMPARATIVE_BENCHMARK_SCHEMA,episode_kind:'REAL_HOST_EPISODE',claim_boundary:'Real host episode; deterministic checks are authoritative and monetary provenance is preserved.',episode_id:'ep-001',repetition:1,system:{kind:'OPENCODE_HI_CURRENT',label:'current-hi',opencode_version:'1.18.18',hi_commit:C,config_sha256:H},task:{task_id:'fixture-trivial-1',scenario_class:'trivial-localized-work',fixture_sha256:H},model:{requested:'p/m',effective:'p/m',provider_effective:'p'},started_at:'2026-08-17T12:00:00.000Z',ended_at:'2026-08-17T12:00:05.000Z',deterministic_checks:[{id:'acceptance',status:'PASS',exit_code:0,evidence_refs:['artifact:acceptance']}],evidence:{required:1,satisfied:1,fresh:1,stale:0,wrong_task_accepted:0,wrong_attempt_accepted:0,false_completion:0},completion_decision:'DONE',failure_injections:[],control_plane:{duplicate_dispatch_count:0,stale_callback_accept_count:0,ambiguous_side_effect_replay_count:0,deadlock_or_stall_count:0,orphan_or_cleanup_failure_count:0,workers_spawned:1,retries:0,replans:0,tool_calls:4,model_calls:1,polling_calls:0,peak_concurrent_workers:1,context_bytes_to_children:1200,mechanically_identified_redundant_actions:0},economics:{wall_time_ms:5000,exact_usage:{tokens:{input:100,output:20,reasoning:5,cache_read:10,cache_write:0},coverage:'COMPLETE_STEP_TOTAL',source:'OPENCODE_STEP_FINISH'},opencode_derived_cost_usd:.001},artifacts:{diff_sha256:H,acceptance_log_sha256:H,receipt_inputs_sha256:H},result:'VERIFIED_SUCCESS'}
  return Object.assign(base,overrides)
}

test('strict comparative receipt accepts exact current-Hi real-host identity and separated economics provenance',()=>{
  assert.equal(isComparativeBenchmarkReceipt(receipt()),true)
})

test('vanilla identity cannot smuggle a Hi commit and Hi baseline/current require an exact commit',()=>{
  const vanilla=receipt({system:{kind:'VANILLA_OPENCODE',label:'vanilla',opencode_version:'1.18.18',config_sha256:H}});assert.equal(isComparativeBenchmarkReceipt(vanilla),true)
  vanilla.system.hi_commit=C;assert.equal(isComparativeBenchmarkReceipt(vanilla),false)
  const missing=receipt();delete missing.system.hi_commit;assert.equal(isComparativeBenchmarkReceipt(missing),false)
})

test('production commit episode requires exact repo/from/to identity',()=>{
  const r=receipt();r.task.scenario_class='production-commit-task';r.task.repo='owner/repo';r.task.from_commit=C;r.task.to_commit='c'.repeat(40);assert.equal(isComparativeBenchmarkReceipt(r),true)
  delete r.task.to_commit;assert.equal(isComparativeBenchmarkReceipt(r),false)
})

test('unknown receipt fields and malformed hashes/timestamps fail closed',()=>{
  assert.equal(isComparativeBenchmarkReceipt({...receipt(),magic:true}),false)
  const bad=receipt();bad.system.config_sha256='short';assert.equal(isComparativeBenchmarkReceipt(bad),false)
  const reversed=receipt();reversed.ended_at='2026-08-17T11:59:59.000Z';assert.equal(isComparativeBenchmarkReceipt(reversed),false)
})

test('exact and estimated usage remain structurally separate and provider billing is not inferred from OpenCode-derived cost',()=>{
  const r=receipt();r.economics.estimated_usage={tokens:130,method:'legacy-estimator'};r.economics.opencode_derived_cost_usd=.002;assert.equal(isComparativeBenchmarkReceipt(r),true)
  r.economics.estimated_usage={method:'empty'};assert.equal(isComparativeBenchmarkReceipt(r),false)
  const derivedOnly=receipt();delete derivedOnly.economics.exact_usage;derivedOnly.economics.opencode_derived_cost_usd=.1;assert.equal(isComparativeBenchmarkReceipt(derivedOnly),true);assert.equal('provider_billed_cost_usd' in derivedOnly.economics,false)
})

test('step-finish exact usage must declare complete coverage while assistant-message fallback may remain partial',()=>{
  const bad=receipt();bad.economics.exact_usage.coverage='PARTIAL_MESSAGE_REPORTED';assert.equal(isComparativeBenchmarkReceipt(bad),false)
  const partial=receipt();partial.economics.exact_usage={...partial.economics.exact_usage,coverage:'PARTIAL_MESSAGE_REPORTED',source:'OPENCODE_ASSISTANT_MESSAGE'};assert.equal(isComparativeBenchmarkReceipt(partial),true)
})

test('VERIFIED_SUCCESS cannot hide failing checks, false completion or side-effect replay',()=>{
  const failed=receipt();failed.deterministic_checks[0].status='FAIL';assert.equal(isComparativeBenchmarkReceipt(failed),false)
  const falseDone=receipt();falseDone.evidence.false_completion=1;assert.equal(isComparativeBenchmarkReceipt(falseDone),false)
  const replay=receipt();replay.control_plane.ambiguous_side_effect_replay_count=1;assert.equal(isComparativeBenchmarkReceipt(replay),false)
})

test('failure injection cannot claim observed when it was not applied',()=>{
  const r=receipt();r.failure_injections=[{id:'f1',kind:'provider-timeout',applied:false,observed:true}];assert.equal(isComparativeBenchmarkReceipt(r),false)
})

test('PASS check requires a machine evidence reference; NOT_RUN may explain absence',()=>{
  const r=receipt();r.deterministic_checks=[{id:'acceptance',status:'PASS',exit_code:0,evidence_refs:[]}];assert.equal(isComparativeBenchmarkReceipt(r),false)
  r.deterministic_checks=[{id:'acceptance',status:'NOT_RUN',evidence_refs:[],detail:'host unavailable'}];r.result='BLOCKED_ENVIRONMENT';assert.equal(isComparativeBenchmarkReceipt(r),true)
})

test('policy ablation must expose a bounded simulation/ablation claim boundary',()=>{
  const r=receipt({episode_kind:'POLICY_ABLATION',claim_boundary:'Policy ablation simulation only; not a real-host superiority claim.'});assert.equal(isComparativeBenchmarkReceipt(r),true)
  r.claim_boundary='Hi is better';assert.equal(isComparativeBenchmarkReceipt(r),false)
})
