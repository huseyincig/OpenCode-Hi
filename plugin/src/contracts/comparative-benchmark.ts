import type {ExecutionTokenUsage} from './execution-usage.js'
import {isExecutionTokenUsage} from './execution-usage.js'

export const COMPARATIVE_BENCHMARK_SCHEMA=1 as const
export type BenchmarkSystemKind='VANILLA_OPENCODE'|'OPENCODE_HI_BASELINE'|'OPENCODE_HI_CURRENT'|'EXTERNAL_BASELINE'
export type BenchmarkEpisodeKind='DETERMINISTIC_FIXTURE'|'REAL_HOST_EPISODE'|'POLICY_ABLATION'
export type BenchmarkScenarioClass='trivial-localized-work'|'failing-test-fix'|'independent-parallel-work'|'dependency-fan-in'|'mutable-surface-conflict'|'misleading-done'|'mutation-after-verification'|'provider-child-failure'|'restart-stale-callback'|'authority-ambiguous-replay'|'context-heavy-investigation'|'plugin-config-coexistence'|'production-commit-task'
export type BenchmarkCheckStatus='PASS'|'FAIL'|'BLOCKED'|'NOT_RUN'
export type BenchmarkResultClassification='VERIFIED_SUCCESS'|'VERIFIED_FAILURE'|'BLOCKED_ENVIRONMENT'|'BLOCKED_AUTHORITY'|'TIMEOUT'|'INVALID_RECEIPT'

export interface BenchmarkSystemIdentity{
  kind:BenchmarkSystemKind
  label:string
  opencode_version:string
  opencode_commit?:string
  hi_commit?:string
  external_version?:string
  config_sha256:string
}
export interface BenchmarkTaskIdentity{
  task_id:string
  scenario_class:BenchmarkScenarioClass
  fixture_sha256:string
  repo?:string
  from_commit?:string
  to_commit?:string
}
export interface BenchmarkModelIdentity{requested?:string;effective?:string;provider_effective?:string}
export interface BenchmarkDeterministicCheck{id:string;status:BenchmarkCheckStatus;exit_code?:number;evidence_refs:string[];detail?:string}
export interface BenchmarkEvidenceSummary{required:number;satisfied:number;fresh:number;stale:number;wrong_task_accepted:number;wrong_attempt_accepted:number;false_completion:number}
export interface BenchmarkControlPlaneMetrics{
  duplicate_dispatch_count:number
  stale_callback_accept_count:number
  ambiguous_side_effect_replay_count:number
  deadlock_or_stall_count:number
  orphan_or_cleanup_failure_count:number
  workers_spawned:number
  retries:number
  replans:number
  tool_calls:number
  model_calls:number
  polling_calls:number
  peak_concurrent_workers:number
  context_bytes_to_children:number
  mechanically_identified_redundant_actions:number
}
export interface BenchmarkExactUsage{
  tokens:ExecutionTokenUsage
  coverage:'COMPLETE_STEP_TOTAL'|'PARTIAL_MESSAGE_REPORTED'
  source:'OPENCODE_STEP_FINISH'|'OPENCODE_ASSISTANT_MESSAGE'|'PROVIDER_USAGE'
}
export interface BenchmarkEstimatedUsage{tokens?:number;cost_usd?:number;method:string}
export interface BenchmarkEconomics{
  wall_time_ms:number
  exact_usage?:BenchmarkExactUsage
  estimated_usage?:BenchmarkEstimatedUsage
  provider_billed_cost_usd?:number
  opencode_derived_cost_usd?:number
}
export interface BenchmarkFailureInjection{id:string;kind:string;applied:boolean;observed:boolean}
export interface BenchmarkArtifacts{diff_sha256?:string;acceptance_log_sha256?:string;receipt_inputs_sha256:string}
export interface ComparativeBenchmarkReceipt{
  schema:typeof COMPARATIVE_BENCHMARK_SCHEMA
  episode_kind:BenchmarkEpisodeKind
  claim_boundary:string
  episode_id:string
  repetition:number
  system:BenchmarkSystemIdentity
  task:BenchmarkTaskIdentity
  model:BenchmarkModelIdentity
  started_at:string
  ended_at:string
  deterministic_checks:BenchmarkDeterministicCheck[]
  evidence:BenchmarkEvidenceSummary
  completion_decision:string
  failure_injections:BenchmarkFailureInjection[]
  control_plane:BenchmarkControlPlaneMetrics
  economics:BenchmarkEconomics
  artifacts:BenchmarkArtifacts
  result:BenchmarkResultClassification
}

const SYSTEM_KINDS=new Set(['VANILLA_OPENCODE','OPENCODE_HI_BASELINE','OPENCODE_HI_CURRENT','EXTERNAL_BASELINE'])
const EPISODE_KINDS=new Set(['DETERMINISTIC_FIXTURE','REAL_HOST_EPISODE','POLICY_ABLATION'])
const SCENARIOS=new Set(['trivial-localized-work','failing-test-fix','independent-parallel-work','dependency-fan-in','mutable-surface-conflict','misleading-done','mutation-after-verification','provider-child-failure','restart-stale-callback','authority-ambiguous-replay','context-heavy-investigation','plugin-config-coexistence','production-commit-task'])
const CHECKS=new Set(['PASS','FAIL','BLOCKED','NOT_RUN'])
const RESULTS=new Set(['VERIFIED_SUCCESS','VERIFIED_FAILURE','BLOCKED_ENVIRONMENT','BLOCKED_AUTHORITY','TIMEOUT','INVALID_RECEIPT'])
const RECEIPT_KEYS=new Set(['schema','episode_kind','claim_boundary','episode_id','repetition','system','task','model','started_at','ended_at','deterministic_checks','evidence','completion_decision','failure_injections','control_plane','economics','artifacts','result'])
const SYSTEM_KEYS=new Set(['kind','label','opencode_version','opencode_commit','hi_commit','external_version','config_sha256'])
const TASK_KEYS=new Set(['task_id','scenario_class','fixture_sha256','repo','from_commit','to_commit'])
const MODEL_KEYS=new Set(['requested','effective','provider_effective'])
const CHECK_KEYS=new Set(['id','status','exit_code','evidence_refs','detail'])
const EVIDENCE_KEYS=new Set(['required','satisfied','fresh','stale','wrong_task_accepted','wrong_attempt_accepted','false_completion'])
const CONTROL_KEYS=new Set(['duplicate_dispatch_count','stale_callback_accept_count','ambiguous_side_effect_replay_count','deadlock_or_stall_count','orphan_or_cleanup_failure_count','workers_spawned','retries','replans','tool_calls','model_calls','polling_calls','peak_concurrent_workers','context_bytes_to_children','mechanically_identified_redundant_actions'])
const ECON_KEYS=new Set(['wall_time_ms','exact_usage','estimated_usage','provider_billed_cost_usd','opencode_derived_cost_usd'])
const EXACT_KEYS=new Set(['tokens','coverage','source'])
const EST_KEYS=new Set(['tokens','cost_usd','method'])
const INJECTION_KEYS=new Set(['id','kind','applied','observed'])
const ARTIFACT_KEYS=new Set(['diff_sha256','acceptance_log_sha256','receipt_inputs_sha256'])
function record(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function exactKeys(v:Record<string,unknown>,keys:Set<string>):boolean{return Object.keys(v).every(k=>keys.has(k))}
function nonEmpty(v:unknown):v is string{return typeof v==='string'&&v.trim().length>0}
function finiteNonnegative(v:unknown):v is number{return typeof v==='number'&&Number.isFinite(v)&&v>=0}
function integerNonnegative(v:unknown):v is number{return Number.isInteger(v)&&Number(v)>=0}
function sha(v:unknown):v is string{return typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v)}
function gitSha(v:unknown):v is string{return typeof v==='string'&&/^[a-f0-9]{7,64}$/i.test(v)}
function iso(v:unknown):v is string{return typeof v==='string'&&Number.isFinite(Date.parse(v))}
function strings(v:unknown):v is string[]{return Array.isArray(v)&&v.every(nonEmpty)}
function validSystem(v:unknown):v is BenchmarkSystemIdentity{if(!record(v)||!exactKeys(v,SYSTEM_KEYS)||!SYSTEM_KINDS.has(String(v.kind))||!nonEmpty(v.label)||!nonEmpty(v.opencode_version)||!sha(v.config_sha256))return false;if(v.opencode_commit!==undefined&&!gitSha(v.opencode_commit)||v.hi_commit!==undefined&&!gitSha(v.hi_commit)||v.external_version!==undefined&&!nonEmpty(v.external_version))return false;if(v.kind==='VANILLA_OPENCODE'&&v.hi_commit!==undefined)return false;if((v.kind==='OPENCODE_HI_BASELINE'||v.kind==='OPENCODE_HI_CURRENT')&&!gitSha(v.hi_commit))return false;if(v.kind==='EXTERNAL_BASELINE'&&!nonEmpty(v.external_version))return false;return true}
function validTask(v:unknown):v is BenchmarkTaskIdentity{if(!record(v)||!exactKeys(v,TASK_KEYS)||!nonEmpty(v.task_id)||!SCENARIOS.has(String(v.scenario_class))||!sha(v.fixture_sha256))return false;for(const k of ['repo','from_commit','to_commit'])if(v[k]!==undefined&&!nonEmpty(v[k]))return false;if(v.scenario_class==='production-commit-task'&&(!nonEmpty(v.repo)||!gitSha(v.from_commit)||!gitSha(v.to_commit)))return false;return true}
function validModel(v:unknown):v is BenchmarkModelIdentity{return record(v)&&exactKeys(v,MODEL_KEYS)&&['requested','effective','provider_effective'].every(k=>v[k]===undefined||nonEmpty(v[k]))}
function validCheck(v:unknown):v is BenchmarkDeterministicCheck{if(!record(v)||!exactKeys(v,CHECK_KEYS)||!nonEmpty(v.id)||!CHECKS.has(String(v.status))||!strings(v.evidence_refs))return false;if(v.exit_code!==undefined&&!Number.isInteger(v.exit_code)||v.detail!==undefined&&!nonEmpty(v.detail))return false;if(v.status==='PASS'&&v.evidence_refs.length===0)return false;return true}
function validEvidence(v:unknown):v is BenchmarkEvidenceSummary{if(!record(v)||!exactKeys(v,EVIDENCE_KEYS)||!Object.values(v).every(integerNonnegative))return false;return Number(v.satisfied)<=Number(v.required)&&Number(v.fresh)<=Number(v.satisfied)&&Number(v.stale)<=Number(v.satisfied)}
function validControl(v:unknown):v is BenchmarkControlPlaneMetrics{return record(v)&&exactKeys(v,CONTROL_KEYS)&&Object.values(v).every(integerNonnegative)}
function validExactUsage(v:unknown):v is BenchmarkExactUsage{return record(v)&&exactKeys(v,EXACT_KEYS)&&isExecutionTokenUsage(v.tokens)&&['COMPLETE_STEP_TOTAL','PARTIAL_MESSAGE_REPORTED'].includes(String(v.coverage))&&['OPENCODE_STEP_FINISH','OPENCODE_ASSISTANT_MESSAGE','PROVIDER_USAGE'].includes(String(v.source))&&!(v.source==='OPENCODE_STEP_FINISH'&&v.coverage!=='COMPLETE_STEP_TOTAL')}
function validEstimated(v:unknown):v is BenchmarkEstimatedUsage{return record(v)&&exactKeys(v,EST_KEYS)&&nonEmpty(v.method)&&(v.tokens===undefined||finiteNonnegative(v.tokens))&&(v.cost_usd===undefined||finiteNonnegative(v.cost_usd))&&(v.tokens!==undefined||v.cost_usd!==undefined)}
function validEconomics(v:unknown):v is BenchmarkEconomics{if(!record(v)||!exactKeys(v,ECON_KEYS)||!finiteNonnegative(v.wall_time_ms))return false;if(v.exact_usage!==undefined&&!validExactUsage(v.exact_usage)||v.estimated_usage!==undefined&&!validEstimated(v.estimated_usage))return false;if(v.provider_billed_cost_usd!==undefined&&!finiteNonnegative(v.provider_billed_cost_usd)||v.opencode_derived_cost_usd!==undefined&&!finiteNonnegative(v.opencode_derived_cost_usd))return false;return true}
function validInjection(v:unknown):v is BenchmarkFailureInjection{return record(v)&&exactKeys(v,INJECTION_KEYS)&&nonEmpty(v.id)&&nonEmpty(v.kind)&&typeof v.applied==='boolean'&&typeof v.observed==='boolean'&&(!v.observed||v.applied)}
function validArtifacts(v:unknown):v is BenchmarkArtifacts{return record(v)&&exactKeys(v,ARTIFACT_KEYS)&&sha(v.receipt_inputs_sha256)&&(v.diff_sha256===undefined||sha(v.diff_sha256))&&(v.acceptance_log_sha256===undefined||sha(v.acceptance_log_sha256))}
export function isComparativeBenchmarkReceipt(v:unknown):v is ComparativeBenchmarkReceipt{
  if(!record(v)||!exactKeys(v,RECEIPT_KEYS)||v.schema!==COMPARATIVE_BENCHMARK_SCHEMA||!EPISODE_KINDS.has(String(v.episode_kind))||!nonEmpty(v.claim_boundary)||!nonEmpty(v.episode_id)||!Number.isInteger(v.repetition)||Number(v.repetition)<1)return false
  if(!validSystem(v.system)||!validTask(v.task)||!validModel(v.model)||!iso(v.started_at)||!iso(v.ended_at)||Date.parse(String(v.ended_at))<Date.parse(String(v.started_at)))return false
  if(!Array.isArray(v.deterministic_checks)||!v.deterministic_checks.every(validCheck)||!validEvidence(v.evidence)||!nonEmpty(v.completion_decision)||!Array.isArray(v.failure_injections)||!v.failure_injections.every(validInjection)||!validControl(v.control_plane)||!validEconomics(v.economics)||!validArtifacts(v.artifacts)||!RESULTS.has(String(v.result)))return false
  if(v.result==='VERIFIED_SUCCESS'&&(v.deterministic_checks.some((x:any)=>x.status!=='PASS')||(v.evidence as any).false_completion!==0||(v.control_plane as any).ambiguous_side_effect_replay_count!==0))return false
  if(v.episode_kind==='POLICY_ABLATION'&&!/ablation|simulation|policy/i.test(String(v.claim_boundary)))return false
  return true
}
