import test from 'node:test'
import assert from 'node:assert/strict'
import {COMPARATIVE_BENCHMARK_SCHEMA} from '../dist/contracts/comparative-benchmark.js'
import {behavioralEvaluationPlatform} from '../dist/runtime/evaluation/platform.js'

const H='a'.repeat(64),S='b'.repeat(64),C='c'.repeat(40)
function receipt({episode='ep',repetition=1,result='VERIFIED_SUCCESS',check='PASS'}={}){
  return{schema:COMPARATIVE_BENCHMARK_SCHEMA,episode_kind:'REAL_HOST_EPISODE',claim_boundary:'bounded real-host episode',episode_id:episode,repetition,system:{kind:'OPENCODE_HI_CURRENT',label:'hi',opencode_version:'1.18.25',hi_commit:C,config_sha256:H},task:{task_id:'case',scenario_class:'failing-test-fix',fixture_sha256:H},model:{requested:'p/m',effective:'p/m',provider_effective:'p'},started_at:'2026-08-31T06:00:00Z',ended_at:'2026-08-31T06:00:01Z',deterministic_checks:[{id:'acceptance',status:check,...(check==='PASS'?{exit_code:0,evidence_refs:['artifact:secret-ref']}:{evidence_refs:[],detail:'host unavailable SECRET_DETAIL'})}],evidence:{required:1,satisfied:check==='PASS'?1:0,fresh:check==='PASS'?1:0,stale:0,wrong_task_accepted:0,wrong_attempt_accepted:0,false_completion:0},completion_decision:result==='VERIFIED_SUCCESS'?'DONE':'BLOCKED',failure_injections:[],control_plane:{duplicate_dispatch_count:0,stale_callback_accept_count:0,ambiguous_side_effect_replay_count:0,deadlock_or_stall_count:0,orphan_or_cleanup_failure_count:0,workers_spawned:1,retries:0,replans:0,tool_calls:1,model_calls:1,polling_calls:0,peak_concurrent_workers:1,context_bytes_to_children:100,mechanically_identified_redundant_actions:0},economics:{wall_time_ms:1000},artifacts:{receipt_inputs_sha256:S},result}
}
const sample=r=>({receipt:r,environment:{source_inputs_sha256:S,platform:'linux-x64',node_version:'22'}})

test('behavioral evaluation platform composes immutable certification and deterministic simulations without production authority',()=>{
  const baseline=receipt(),current=receipt({episode:'cur'})
  const before=structuredClone(current),view=behavioralEvaluationPlatform({series_id:'s',claim_boundary:'evaluation only',baseline:sample(baseline),current:[sample(current)]})
  assert.equal(view.certification.verdict,'NO_REGRESSION')
  assert.equal(view.boundaries.judge_role,'advisory-uncertainty-only')
  assert.equal(view.boundaries.routing_authority,false);assert.equal(view.boundaries.completion_authority,false);assert.equal(view.boundaries.authority_override,false);assert.equal(view.boundaries.model_preference_persistence,false)
  assert.equal(view.persistence_owner,'none-derived-evaluation-view');assert.equal(view.claim_boundary,'evaluation-certification-composition-only')
  assert.equal(view.deterministic_policy_evidence.runtime.length,9);assert.equal(view.deterministic_policy_evidence.scheduler.length,3)
  assert.deepEqual(current,before,'evaluation must not mutate exact episode receipt input')
  assert.equal(JSON.stringify(view.certification).includes('artifact:secret-ref'),false,'certification projection must reference receipt identity, not copy raw episode evidence refs')
})

test('judge consensus remains advisory and cannot override a deterministic stable regression',()=>{
  const baseline=receipt(),current=[1,2,3].map(i=>{const r=receipt({episode:`f${i}`,repetition:i,result:'VERIFIED_FAILURE',check:'FAIL'});r.deterministic_checks=[{id:'acceptance',status:'FAIL',exit_code:1,evidence_refs:['artifact:failure']}];r.completion_decision='VERIFY';return sample(r)})
  const view=behavioralEvaluationPlatform({series_id:'fail',claim_boundary:'evaluation only',baseline:sample(baseline),current,judge_scores:[[1,1,1],[1,1,1]],evidence_families:['judge','judge']})
  assert.equal(view.certification.uncertainty.judge_agreement.fleiss_kappa,1)
  assert.equal(view.certification.verdict,'STABLE_REGRESSION')
  assert.equal(view.certification.uncertainty.advisory_only,true)
})

test('environment blocker stays distinct and missing judge data remains explicit rather than inferred',()=>{
  const baseline=receipt(),blocked=receipt({episode:'blocked',result:'BLOCKED_ENVIRONMENT',check:'NOT_RUN'})
  const view=behavioralEvaluationPlatform({series_id:'blocked',claim_boundary:'evaluation only',baseline:sample(baseline),current:[sample(blocked)]})
  assert.equal(view.certification.verdict,'BLOCKED_ENVIRONMENT')
  assert.equal(view.certification.uncertainty.judge_agreement.status,'NOT_PROVIDED')
  assert.equal(view.certification.attribution.reliable,false)
})
