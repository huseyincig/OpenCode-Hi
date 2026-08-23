import type { MissionState,MissionTask,WorkerResult,WorkerState } from '../mission/types.js'
import { normalizeBoundedProjectPath } from '../../contracts/common.js'
import { captureEvidenceScopeState,evidenceScopeStateIsCurrent } from '../evidence/scope-state.js'

export type ExplorationClearanceReason=
  |'not-applicable'
  |'result-not-done'
  |'context-gap-not-explicitly-resolved'
  |'open-context-remains'
  |'open-issue-remains'
  |'source-provenance-claim-missing'
  |'source-provenance-scope-unbounded'
  |'source-read-receipt-missing'
  |'source-provenance-outside-task-scope'
  |'source-state-unavailable'
  |'decision-claim-missing'
  |'decision-claim-scope-unbound'
  |'admitted'

export interface ExplorationClearanceAssessment{
  applicable:boolean
  admitted:boolean
  reason:ExplorationClearanceReason
  ambiguity:'none'|'resolvable'|'contract-critical'
  source_scope:string[]
  source_state_hash?:string
  decision_scope:string[]
}
export interface ExplorationClearanceFreshness{
  required:boolean
  current:boolean
  ambiguity?:'resolvable'|'contract-critical'
  evidence_id?:string
  source_scope:string[]
  source_state_hash?:string
  reason:'never-required'|'current'|'invalidated'|'source-state-drift'|'malformed-source'
}

const SOURCE_PREFIX='exploration-clearance:'
function bounded(items:readonly string[]=[]):string[]{return[...new Set(items.map(item=>normalizeBoundedProjectPath(item)).filter((item):item is string=>Boolean(item)))].sort()}
function within(admitted:string[],candidate:string):boolean{return admitted.some(root=>candidate===root||candidate.startsWith(`${root}/`))}
function passed(result:WorkerResult,kind:'source-provenance-evidence'|'decision-evidence'){return result.evidence.filter(item=>item.kind===kind&&(item.outcome==='passed'||item.pass===true))}
function sourceAmbiguity(source:string|undefined):'resolvable'|'contract-critical'|undefined{const match=new RegExp(`^${SOURCE_PREFIX}(resolvable|contract-critical):`).exec(source??'');return match?.[1] as 'resolvable'|'contract-critical'|undefined}
export function explorationClearanceEvidenceSource(ambiguity:'resolvable'|'contract-critical',taskID:string):string{return`${SOURCE_PREFIX}${ambiguity}:${taskID}`}

/** Freshness fence for a previously admitted exploration clearance. */
export function explorationClearanceFreshness(projectRoot:string,m:MissionState):ExplorationClearanceFreshness{
  const candidates=m.execution.evidence.items.filter(item=>item.kind==='source-provenance-evidence'&&String(item.source??'').startsWith(SOURCE_PREFIX)).sort((a,b)=>a.observed_at-b.observed_at)
  const latest=candidates.at(-1);if(!latest)return{required:false,current:true,source_scope:[],reason:'never-required'}
  const ambiguity=sourceAmbiguity(latest.source),source_scope=bounded(latest.scope)
  if(!ambiguity||!source_scope.length||!latest.scope_state_hash)return{required:true,current:false,ambiguity,evidence_id:latest.id,source_scope,source_state_hash:latest.scope_state_hash,reason:'malformed-source'}
  if(latest.invalidated_at)return{required:true,current:false,ambiguity,evidence_id:latest.id,source_scope,source_state_hash:latest.scope_state_hash,reason:'invalidated'}
  if(!evidenceScopeStateIsCurrent(projectRoot,source_scope,latest.scope_state_hash))return{required:true,current:false,ambiguity,evidence_id:latest.id,source_scope,source_state_hash:latest.scope_state_hash,reason:'source-state-drift'}
  return{required:true,current:true,ambiguity,evidence_id:latest.id,source_scope,source_state_hash:latest.scope_state_hash,reason:'current'}
}

/**
 * Repository exploration may change semantic ambiguity, but it is not verification proof.
 * Clearance requires explicit structured sufficiency plus runtime-bound current source bytes.
 * Contract-critical ambiguity additionally requires a scoped decision claim; that claim remains
 * WorkerResult provenance and is never promoted to canonical Evidence by this mechanism.
 */
export function assessExplorationClearance(projectRoot:string,m:MissionState,task:MissionTask,worker:WorkerState,result:WorkerResult):ExplorationClearanceAssessment{
  const freshness=explorationClearanceFreshness(projectRoot,m)
  const ambiguity:ExplorationClearanceAssessment['ambiguity']=m.identity.intent.ambiguity!=='none'?m.identity.intent.ambiguity:(!freshness.current&&freshness.ambiguity?freshness.ambiguity:'none')
  const base:Pick<ExplorationClearanceAssessment,'applicable'|'ambiguity'|'source_scope'|'decision_scope'>={applicable:worker.role==='repository-explorer'&&ambiguity!=='none',ambiguity,source_scope:[],decision_scope:[]}
  if(!base.applicable)return{...base,admitted:false,reason:'not-applicable'}
  if(result.status!=='DONE')return{...base,admitted:false,reason:'result-not-done'}
  if(result.context_gap!=='none')return{...base,admitted:false,reason:'context-gap-not-explicitly-resolved'}
  if(result.needs_context.length)return{...base,admitted:false,reason:'open-context-remains'}
  if(result.open_issues.length)return{...base,admitted:false,reason:'open-issue-remains'}
  const sourceClaims=passed(result,'source-provenance-evidence')
  if(!sourceClaims.length)return{...base,admitted:false,reason:'source-provenance-claim-missing'}
  const sourceRaw=sourceClaims.flatMap(item=>item.scope??[]),source_scope=bounded(sourceRaw),rawBounded=sourceRaw.map(item=>normalizeBoundedProjectPath(item))
  if(!source_scope.length||rawBounded.some(item=>!item))return{...base,source_scope,admitted:false,reason:'source-provenance-scope-unbounded'}
  const taskScope=bounded(task.scope)
  if(taskScope.length&&source_scope.some(file=>!within(taskScope,file)))return{...base,source_scope,admitted:false,reason:'source-provenance-outside-task-scope'}
  const requestedRefs=[...new Set(sourceClaims.flatMap(item=>item.evidence_refs??[]))],readReceipts=requestedRefs.map(id=>m.execution.evidence.items.find(item=>item.id===id)).filter((item):item is NonNullable<typeof item>=>Boolean(item))
  const exactAttemptReceipts=readReceipts.filter(item=>item.kind==='source-read-observation'&&item.trusted_source_class==='host-tool-observation'&&item.source===`explorer-read:${worker.id}`&&item.source_session_id===worker.session_id&&item.task_id===task.id&&!item.invalidated_at&&item.outcome!=='failed'&&item.producer_attempt?.worker_id===worker.id&&item.producer_attempt.ordinal===worker.attempt&&item.producer_attempt.generation===(worker.generation_at_spawn??m.continuation.generation))
  const receiptScope=bounded(exactAttemptReceipts.flatMap(item=>item.scope))
  if(!requestedRefs.length||exactAttemptReceipts.length!==requestedRefs.length||source_scope.some(file=>!receiptScope.includes(file)))return{...base,source_scope,admitted:false,reason:'source-read-receipt-missing'}
  const source_state_hash=captureEvidenceScopeState(projectRoot,source_scope)
  if(!source_state_hash)return{...base,source_scope,admitted:false,reason:'source-state-unavailable'}
  const decisionClaims=passed(result,'decision-evidence'),decisionRaw=decisionClaims.flatMap(item=>item.scope??[]),decision_scope=bounded(decisionRaw)
  if(ambiguity==='contract-critical'){
    if(!decisionClaims.length)return{...base,source_scope,source_state_hash,decision_scope,admitted:false,reason:'decision-claim-missing'}
    const decisionRefs=[...new Set(decisionClaims.flatMap(item=>item.evidence_refs??[]))]
    if(!decision_scope.length||decisionRaw.some(item=>!normalizeBoundedProjectPath(item))||decision_scope.some(file=>!within(source_scope,file))||!decisionRefs.length||decisionRefs.some(id=>!requestedRefs.includes(id)))return{...base,source_scope,source_state_hash,decision_scope,admitted:false,reason:'decision-claim-scope-unbound'}
  }
  return{...base,source_scope,source_state_hash,decision_scope,admitted:true,reason:'admitted'}
}
