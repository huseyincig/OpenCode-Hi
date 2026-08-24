import {createHash} from 'node:crypto'
import {stableJson} from './common.js'
import {isComparativeBenchmarkReceipt,type BenchmarkEpisodeKind,type BenchmarkResultClassification,type ComparativeBenchmarkReceipt} from './comparative-benchmark.js'
import {buildEvalUncertaintyDiagnostics,type EvalUncertaintyDiagnostics} from './eval-uncertainty.js'

export const COMPARATIVE_BENCHMARK_CERTIFICATION_SCHEMA=1 as const
export type BenchmarkCertificationVerdict='NO_REGRESSION'|'STABLE_REGRESSION'|'FLAKY'|'BLOCKED_ENVIRONMENT'|'BLOCKED_AUTHORITY'|'INCONCLUSIVE'
export type BenchmarkFailureAttributionClass='SOURCE_CHANGED'|'FIXTURE_CHANGED'|'CONFIG_CHANGED'|'HOST_CHANGED'|'MODEL_CHANGED'|'RUNTIME_CHANGED'|'UNKNOWN_DRIFT'

export interface BenchmarkCertificationEnvironmentInput{
  source_inputs_sha256:string
  platform?:string
  node_version?:string
}
export interface BenchmarkCertificationEnvironment{
  source_inputs_sha256:string
  fixture_sha256:string
  config_sha256:string
  opencode_version:string
  opencode_commit?:string
  model_requested?:string
  model_effective?:string
  provider_effective?:string
  platform?:string
  node_version?:string
}
export interface BenchmarkCertificationSampleInput{receipt:ComparativeBenchmarkReceipt;environment:BenchmarkCertificationEnvironmentInput}
export interface BenchmarkCertificationSample{
  receipt_sha256:string
  episode_id:string
  repetition:number
  episode_kind:BenchmarkEpisodeKind
  result:BenchmarkResultClassification
  outcome_sha256:string
  environment:BenchmarkCertificationEnvironment
}
export interface BenchmarkEnvironmentDelta{
  keys_changed:string[]
  details:Record<string,{baseline?:string;current?:string}>
}
export interface BenchmarkStabilitySummary{
  required_samples:number
  observed_samples:number
  performed:boolean
  stable:boolean
  outcome_hashes:string[]
}
export interface BenchmarkFailureAttribution{
  top:BenchmarkFailureAttributionClass
  also_observed:BenchmarkFailureAttributionClass[]
  reliable:boolean
  reason:string
  evidence:BenchmarkEnvironmentDelta
}
export interface ComparativeBenchmarkCertificationSeries{
  schema:typeof COMPARATIVE_BENCHMARK_CERTIFICATION_SCHEMA
  series_id:string
  claim_boundary:string
  baseline:BenchmarkCertificationSample
  current:BenchmarkCertificationSample[]
  stability:BenchmarkStabilitySummary
  environment_stable:boolean
  environment_delta:BenchmarkEnvironmentDelta
  attribution:BenchmarkFailureAttribution
  uncertainty?:EvalUncertaintyDiagnostics
  verdict:BenchmarkCertificationVerdict
}
export interface BuildComparativeBenchmarkCertificationSeriesInput{
  series_id:string
  claim_boundary:string
  baseline:BenchmarkCertificationSampleInput
  current:BenchmarkCertificationSampleInput[]
  judge_scores?:number[][]
  evidence_families?:string[]
}

const SHA=/^[a-f0-9]{64}$/i
const GIT_SHA=/^[a-f0-9]{7,64}$/i
const VERDICTS=new Set<BenchmarkCertificationVerdict>(['NO_REGRESSION','STABLE_REGRESSION','FLAKY','BLOCKED_ENVIRONMENT','BLOCKED_AUTHORITY','INCONCLUSIVE'])
const ATTRIBUTIONS=new Set<BenchmarkFailureAttributionClass>(['SOURCE_CHANGED','FIXTURE_CHANGED','CONFIG_CHANGED','HOST_CHANGED','MODEL_CHANGED','RUNTIME_CHANGED','UNKNOWN_DRIFT'])
const SERIES_KEYS=new Set(['schema','series_id','claim_boundary','baseline','current','stability','environment_stable','environment_delta','attribution','uncertainty','verdict'])
const SAMPLE_KEYS=new Set(['receipt_sha256','episode_id','repetition','episode_kind','result','outcome_sha256','environment'])
const ENV_KEYS=new Set(['source_inputs_sha256','fixture_sha256','config_sha256','opencode_version','opencode_commit','model_requested','model_effective','provider_effective','platform','node_version'])
const STABILITY_KEYS=new Set(['required_samples','observed_samples','performed','stable','outcome_hashes'])
const DELTA_KEYS=new Set(['keys_changed','details'])
const ATTR_KEYS=new Set(['top','also_observed','reliable','reason','evidence'])
const ENV_ORDER=[...ENV_KEYS]
const CLASS_PRIORITY:BenchmarkFailureAttributionClass[]=['SOURCE_CHANGED','FIXTURE_CHANGED','CONFIG_CHANGED','HOST_CHANGED','MODEL_CHANGED','RUNTIME_CHANGED']
const CLASS_BY_ENV_KEY:Record<string,BenchmarkFailureAttributionClass>={
  source_inputs_sha256:'SOURCE_CHANGED',
  fixture_sha256:'FIXTURE_CHANGED',
  config_sha256:'CONFIG_CHANGED',
  opencode_version:'HOST_CHANGED',opencode_commit:'HOST_CHANGED',
  model_requested:'MODEL_CHANGED',model_effective:'MODEL_CHANGED',provider_effective:'MODEL_CHANGED',
  platform:'RUNTIME_CHANGED',node_version:'RUNTIME_CHANGED',
}
function record(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function exactKeys(v:Record<string,unknown>,keys:Set<string>):boolean{return Object.keys(v).every(k=>keys.has(k))}
function nonEmpty(v:unknown):v is string{return typeof v==='string'&&v.trim().length>0}
function integer(v:unknown):v is number{return Number.isInteger(v)&&Number(v)>=0}
function hash(value:unknown):string{return createHash('sha256').update(stableJson(value)).digest('hex')}

function outcomeProjection(receipt:ComparativeBenchmarkReceipt):unknown{
  return{
    result:receipt.result,
    completion_decision:receipt.completion_decision,
    deterministic_checks:[...receipt.deterministic_checks].map(check=>({id:check.id,status:check.status,...(check.exit_code===undefined?{}:{exit_code:check.exit_code})})).sort((a,b)=>a.id.localeCompare(b.id)),
    evidence:{...receipt.evidence},
    failure_injections:[...receipt.failure_injections].map(item=>({id:item.id,kind:item.kind,applied:item.applied,observed:item.observed})).sort((a,b)=>a.id.localeCompare(b.id)),
    safety:{
      duplicate_dispatch_count:receipt.control_plane.duplicate_dispatch_count,
      stale_callback_accept_count:receipt.control_plane.stale_callback_accept_count,
      ambiguous_side_effect_replay_count:receipt.control_plane.ambiguous_side_effect_replay_count,
      deadlock_or_stall_count:receipt.control_plane.deadlock_or_stall_count,
      orphan_or_cleanup_failure_count:receipt.control_plane.orphan_or_cleanup_failure_count,
    },
  }
}
function environmentFrom(input:BenchmarkCertificationSampleInput):BenchmarkCertificationEnvironment{
  if(!isComparativeBenchmarkReceipt(input.receipt))throw new Error('comparative benchmark certification sample requires a valid ComparativeBenchmarkReceipt')
  if(!SHA.test(input.environment.source_inputs_sha256))throw new Error('source_inputs_sha256 must be an exact SHA-256')
  if(input.environment.source_inputs_sha256!==input.receipt.artifacts.receipt_inputs_sha256)throw new Error('certification source input hash must match the exact episode receipt input hash')
  for(const key of ['platform','node_version'] as const)if(input.environment[key]!==undefined&&!nonEmpty(input.environment[key]))throw new Error(`${key} must be non-empty when supplied`)
  const r=input.receipt
  return{
    source_inputs_sha256:input.environment.source_inputs_sha256,
    fixture_sha256:r.task.fixture_sha256,
    config_sha256:r.system.config_sha256,
    opencode_version:r.system.opencode_version,
    ...(r.system.opencode_commit?{opencode_commit:r.system.opencode_commit}:{}),
    ...(r.model.requested?{model_requested:r.model.requested}:{}),
    ...(r.model.effective?{model_effective:r.model.effective}:{}),
    ...(r.model.provider_effective?{provider_effective:r.model.provider_effective}:{}),
    ...(input.environment.platform?{platform:input.environment.platform}:{}),
    ...(input.environment.node_version?{node_version:input.environment.node_version}:{}),
  }
}
function sampleFrom(input:BenchmarkCertificationSampleInput):BenchmarkCertificationSample{
  const receipt=input.receipt
  if(!isComparativeBenchmarkReceipt(receipt))throw new Error('comparative benchmark certification sample requires a valid ComparativeBenchmarkReceipt')
  return{receipt_sha256:hash(receipt),episode_id:receipt.episode_id,repetition:receipt.repetition,episode_kind:receipt.episode_kind,result:receipt.result,outcome_sha256:hash(outcomeProjection(receipt)),environment:environmentFrom(input)}
}
function envValue(environment:BenchmarkCertificationEnvironment,key:string):string|undefined{return (environment as unknown as Record<string,string|undefined>)[key]}
function diffEnvironment(baseline:BenchmarkCertificationEnvironment,current:BenchmarkCertificationEnvironment):BenchmarkEnvironmentDelta{
  const keys=ENV_ORDER.filter(key=>envValue(baseline,key)!==envValue(current,key))
  const details:BenchmarkEnvironmentDelta['details']={}
  for(const key of keys)details[key]={...(envValue(baseline,key)===undefined?{}:{baseline:envValue(baseline,key)}),...(envValue(current,key)===undefined?{}:{current:envValue(current,key)})}
  return{keys_changed:keys,details}
}
function sameEnvironment(a:BenchmarkCertificationEnvironment,b:BenchmarkCertificationEnvironment):boolean{return stableJson(a)===stableJson(b)}
function attributionFor(delta:BenchmarkEnvironmentDelta,reliableContext:boolean,contextReason:string):BenchmarkFailureAttribution{
  const observed=[...new Set(delta.keys_changed.map(key=>CLASS_BY_ENV_KEY[key]).filter((value):value is BenchmarkFailureAttributionClass=>Boolean(value)))]
  const ordered=CLASS_PRIORITY.filter(value=>observed.includes(value))
  const top=ordered[0]??'UNKNOWN_DRIFT',also=ordered.slice(1)
  if(!reliableContext)return{top,also_observed:also,reliable:false,reason:contextReason,evidence:delta}
  if(ordered.length>1)return{top,also_observed:also,reliable:false,reason:'Multiple environment classes changed; causal attribution is not singular.',evidence:delta}
  return{top,also_observed:also,reliable:true,reason:top==='UNKNOWN_DRIFT'?'Stable failure with no classified environment delta; cause remains unknown.':'Stable failure with one classified environment delta.',evidence:delta}
}
function isFailureResult(result:BenchmarkResultClassification):boolean{return result==='VERIFIED_FAILURE'||result==='TIMEOUT'}
function ensureComparable(baseline:ComparativeBenchmarkReceipt,current:ComparativeBenchmarkReceipt[]):void{
  const seen=new Set<number>()
  for(const r of current){
    if(r.task.task_id!==baseline.task.task_id||r.task.scenario_class!==baseline.task.scenario_class)throw new Error('certification samples must bind the same task_id and scenario_class as baseline')
    if(r.episode_kind!==baseline.episode_kind)throw new Error('certification samples must bind the same episode kind as baseline')
    if(r.system.kind!==baseline.system.kind)throw new Error('certification samples must bind the same system kind as baseline')
    if(seen.has(r.repetition))throw new Error(`duplicate repetition ${r.repetition} in certification samples`)
    seen.add(r.repetition)
  }
}

export function buildComparativeBenchmarkCertificationSeries(input:BuildComparativeBenchmarkCertificationSeriesInput):ComparativeBenchmarkCertificationSeries{
  if(!nonEmpty(input.series_id)||!nonEmpty(input.claim_boundary))throw new Error('certification series requires non-empty series_id and claim_boundary')
  if(!isComparativeBenchmarkReceipt(input.baseline.receipt))throw new Error('certification baseline requires a valid ComparativeBenchmarkReceipt')
  if(!Array.isArray(input.current)||input.current.length===0)throw new Error('certification series requires at least one current sample')
  for(const item of input.current)if(!isComparativeBenchmarkReceipt(item.receipt))throw new Error('certification current sample requires a valid ComparativeBenchmarkReceipt')
  ensureComparable(input.baseline.receipt,input.current.map(item=>item.receipt))
  const baseline=sampleFrom(input.baseline),current=input.current.map(sampleFrom).sort((a,b)=>a.repetition-b.repetition)
  const environmentStable=current.every(sample=>sameEnvironment(sample.environment,current[0].environment))
  const environmentDelta=diffEnvironment(baseline.environment,current[0].environment)
  const outcomes=current.map(sample=>sample.outcome_sha256),outcomeStable=outcomes.every(value=>value===outcomes[0])
  const results=current.map(sample=>sample.result),all=(value:BenchmarkResultClassification)=>results.every(result=>result===value)
  const failureObserved=results.some(isFailureResult)
  const deterministic=current.every(sample=>sample.episode_kind==='DETERMINISTIC_FIXTURE')
  const requiredSamples=failureObserved&&!deterministic?3:1
  const observedSamples=current.length
  const performed=requiredSamples>1&&observedSamples>=requiredSamples
  const stable=deterministic?outcomeStable:(failureObserved&&observedSamples>=requiredSamples?outcomeStable:true)
  const stability:BenchmarkStabilitySummary={required_samples:requiredSamples,observed_samples:observedSamples,performed,stable,outcome_hashes:outcomes}

  let verdict:BenchmarkCertificationVerdict='INCONCLUSIVE',reliableContext=false,reason='Series does not establish a stable regression.'
  if(input.baseline.receipt.result!=='VERIFIED_SUCCESS'){reason='Baseline is not VERIFIED_SUCCESS; regression comparison is inconclusive.'}
  else if(results.some(result=>result==='INVALID_RECEIPT')){reason='At least one current sample is INVALID_RECEIPT.'}
  else if(all('BLOCKED_ENVIRONMENT')){verdict='BLOCKED_ENVIRONMENT';reason='Current episode is blocked by environment, not classified as a product regression.'}
  else if(all('BLOCKED_AUTHORITY')){verdict='BLOCKED_AUTHORITY';reason='Current episode is blocked by authority, not classified as a product regression.'}
  else if(results.some(result=>result==='BLOCKED_ENVIRONMENT'||result==='BLOCKED_AUTHORITY')){reason='Current samples mix blocked and executable outcomes.'}
  else if(all('VERIFIED_SUCCESS')){verdict='NO_REGRESSION';reason='All observed current samples are VERIFIED_SUCCESS.'}
  else if(!environmentStable){reason='Environment identity changed between current stability samples.'}
  else if(failureObserved&&observedSamples<requiredSamples){reason=`Failure requires ${requiredSamples} samples; observed ${observedSamples}.`}
  else if(!outcomeStable){verdict='FLAKY';reason='Current sample outcome fingerprints diverged.'}
  else if(results.every(isFailureResult)){verdict='STABLE_REGRESSION';reliableContext=true;reason='Failure outcome is stable under the required sample policy.'}
  else{reason='Current samples do not form a single stable success, blocked state, or failure class.'}
  const attribution=attributionFor(environmentDelta,reliableContext,reason),uncertainty=buildEvalUncertaintyDiagnostics({wall_times_ms:input.current.map(item=>item.receipt.economics.wall_time_ms),judge_scores:input.judge_scores,evidence_families:input.evidence_families})
  return{schema:COMPARATIVE_BENCHMARK_CERTIFICATION_SCHEMA,series_id:input.series_id,claim_boundary:input.claim_boundary,baseline,current,stability,environment_stable:environmentStable,environment_delta:environmentDelta,attribution,uncertainty,verdict}
}

function validEnvironment(v:unknown):v is BenchmarkCertificationEnvironment{
  if(!record(v)||!exactKeys(v,ENV_KEYS)||!SHA.test(String(v.source_inputs_sha256))||!SHA.test(String(v.fixture_sha256))||!SHA.test(String(v.config_sha256))||!nonEmpty(v.opencode_version))return false
  if(v.opencode_commit!==undefined&&!GIT_SHA.test(String(v.opencode_commit)))return false
  for(const key of ['model_requested','model_effective','provider_effective','platform','node_version'])if(v[key]!==undefined&&!nonEmpty(v[key]))return false
  return true
}
function validSample(v:unknown):v is BenchmarkCertificationSample{return record(v)&&exactKeys(v,SAMPLE_KEYS)&&SHA.test(String(v.receipt_sha256))&&nonEmpty(v.episode_id)&&Number.isInteger(v.repetition)&&Number(v.repetition)>=1&&['DETERMINISTIC_FIXTURE','REAL_HOST_EPISODE','POLICY_ABLATION'].includes(String(v.episode_kind))&&['VERIFIED_SUCCESS','VERIFIED_FAILURE','BLOCKED_ENVIRONMENT','BLOCKED_AUTHORITY','TIMEOUT','INVALID_RECEIPT'].includes(String(v.result))&&SHA.test(String(v.outcome_sha256))&&validEnvironment(v.environment)}
function validDelta(v:unknown):v is BenchmarkEnvironmentDelta{
  if(!record(v)||!exactKeys(v,DELTA_KEYS)||!Array.isArray(v.keys_changed)||!record(v.details))return false
  const keys=v.keys_changed
  if(!keys.every((key):key is string=>typeof key==='string'&&ENV_KEYS.has(key))||new Set(keys).size!==keys.length)return false
  if(Object.keys(v.details).some(key=>!keys.includes(key)))return false
  return Object.entries(v.details).every(([,detail])=>record(detail)&&Object.keys(detail).every(key=>['baseline','current'].includes(key))&&Object.values(detail).every(value=>value===undefined||typeof value==='string'))
}
function validStability(v:unknown):v is BenchmarkStabilitySummary{return record(v)&&exactKeys(v,STABILITY_KEYS)&&integer(v.required_samples)&&Number(v.required_samples)>=1&&integer(v.observed_samples)&&Number(v.observed_samples)>=1&&typeof v.performed==='boolean'&&typeof v.stable==='boolean'&&Array.isArray(v.outcome_hashes)&&v.outcome_hashes.length===v.observed_samples&&v.outcome_hashes.every(value=>typeof value==='string'&&SHA.test(value))}
function isAttributionClass(v:unknown):v is BenchmarkFailureAttributionClass{return typeof v==='string'&&ATTRIBUTIONS.has(v as BenchmarkFailureAttributionClass)}
function isVerdict(v:unknown):v is BenchmarkCertificationVerdict{return typeof v==='string'&&VERDICTS.has(v as BenchmarkCertificationVerdict)}
function validAttribution(v:unknown):v is BenchmarkFailureAttribution{return record(v)&&exactKeys(v,ATTR_KEYS)&&isAttributionClass(v.top)&&Array.isArray(v.also_observed)&&v.also_observed.every(isAttributionClass)&&typeof v.reliable==='boolean'&&nonEmpty(v.reason)&&validDelta(v.evidence)}
function validDistribution(v:unknown):boolean{return record(v)&&Object.keys(v).every(k=>['sample_count','mean','sample_stddev','confidence_level','confidence_interval_95'].includes(k))&&Object.keys(v).length===5&&integer(v.sample_count)&&Number(v.sample_count)>=1&&typeof v.mean==='number'&&Number.isFinite(v.mean)&&Number(v.mean)>=0&&typeof v.sample_stddev==='number'&&Number.isFinite(v.sample_stddev)&&Number(v.sample_stddev)>=0&&v.confidence_level===0.95&&Array.isArray(v.confidence_interval_95)&&v.confidence_interval_95.length===2&&v.confidence_interval_95.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0)&&Number(v.confidence_interval_95[0])<=Number(v.confidence_interval_95[1])}
function validJudge(v:unknown):boolean{if(!record(v)||Object.keys(v).some(k=>!['status','item_count','judge_count','fleiss_kappa','band'].includes(k))||!['NOT_PROVIDED','INSUFFICIENT','MEASURED'].includes(String(v.status))||!integer(v.item_count)||!integer(v.judge_count))return false;if(v.status==='MEASURED')return typeof v.fleiss_kappa==='number'&&Number.isFinite(v.fleiss_kappa)&&v.fleiss_kappa>=-1&&v.fleiss_kappa<=1&&['LESS_THAN_CHANCE','SLIGHT','FAIR','MODERATE','SUBSTANTIAL','ALMOST_PERFECT'].includes(String(v.band));return v.fleiss_kappa===undefined&&v.band===undefined}
function validDiversity(v:unknown):boolean{return record(v)&&Object.keys(v).every(k=>['status','evidence_count','unique_family_count','largest_family_count','largest_family_share','families'].includes(k))&&Object.keys(v).length===6&&['NOT_PROVIDED','INSUFFICIENT','MEASURED'].includes(String(v.status))&&integer(v.evidence_count)&&integer(v.unique_family_count)&&integer(v.largest_family_count)&&typeof v.largest_family_share==='number'&&Number.isFinite(v.largest_family_share)&&v.largest_family_share>=0&&v.largest_family_share<=1&&record(v.families)&&Object.values(v.families).every(integer)}
function validUncertainty(v:unknown):boolean{return record(v)&&Object.keys(v).every(k=>['advisory_only','wall_time_ms','judge_agreement','evidence_family_diversity','flags'].includes(k))&&Object.keys(v).length===5&&v.advisory_only===true&&validDistribution(v.wall_time_ms)&&validJudge(v.judge_agreement)&&validDiversity(v.evidence_family_diversity)&&Array.isArray(v.flags)&&v.flags.every(x=>['JUDGE_DISAGREEMENT','INSUFFICIENT_JUDGE_DATA','INSUFFICIENT_EVIDENCE_DIVERSITY','LOW_EVIDENCE_FAMILY_DIVERSITY'].includes(String(x)))}
export function isComparativeBenchmarkCertificationSeries(v:unknown):v is ComparativeBenchmarkCertificationSeries{
  if(!record(v)||!exactKeys(v,SERIES_KEYS)||v.schema!==COMPARATIVE_BENCHMARK_CERTIFICATION_SCHEMA||!nonEmpty(v.series_id)||!nonEmpty(v.claim_boundary)||!validSample(v.baseline)||!Array.isArray(v.current)||v.current.length===0||!v.current.every(validSample)||!validStability(v.stability)||typeof v.environment_stable!=='boolean'||!validDelta(v.environment_delta)||!validAttribution(v.attribution)||(v.uncertainty!==undefined&&!validUncertainty(v.uncertainty))||!isVerdict(v.verdict))return false
  if(stableJson(v.environment_delta)!==stableJson(v.attribution.evidence))return false
  if(new Set(v.current.map(sample=>sample.repetition)).size!==v.current.length)return false
  if(v.verdict==='STABLE_REGRESSION'&&(!v.stability.stable||!v.attribution.reliable&&v.attribution.also_observed.length===0&&v.attribution.top!=='UNKNOWN_DRIFT'))return false
  return true
}
