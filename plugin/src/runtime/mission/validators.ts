import type { MissionState,NormalizedMissionIntent } from './types.js'
import { isEvidenceItemContract } from '../../contracts/evidence.js'
import { isTaskContract } from '../../contracts/task.js'
import { isWorkerContract } from '../../contracts/worker.js'
import { isHumanDecisionContract } from '../../contracts/human-decision.js'
import { isAuthorityStateContract } from '../../contracts/authority.js'
import { isExternalActionType } from '../../contracts/external-action.js'
import { HI_METHODOLOGY_PRODUCERS, HI_METHODOLOGY_SIGNAL_CATALOG, HI_METHODOLOGY_TRIGGER_SOURCES } from '../../generated/methodology-policy.js'
import { SEMANTIC_CAPABILITIES, SEMANTIC_VERIFICATION_KINDS } from '../intent/semantic-assessment.js'
import { isProcessContract } from '../../contracts/process.js'
import { isIsolationDecisionContract,isWorkspaceLeaseContract } from '../../contracts/workspace.js'
import { isSchedulerLifecycleState } from '../../contracts/orchestration-core.js'
import { isProgressDelta,isSemanticProgressSnapshot } from '../progress/semantic-progress.js'
import { isRecoveryStrategyRecord } from '../continuation/recovery-governor.js'
import { normalizeBoundedProjectPath } from '../../contracts/common.js'
import { isConstraintAtom } from '../../contracts/constraint-atom.js'
import { hasFreshPassedEvidence } from '../evidence/freshness.js'

function isRecord(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value)}
function stringArray(value:unknown):value is string[]{return Array.isArray(value)&&value.every(item=>typeof item==='string')}
function recordArray(value:unknown):value is Record<string,unknown>[]{return Array.isArray(value)&&value.every(isRecord)}
function uniqueRecordIDs(values:unknown[]):boolean{const ids=values.map(value=>isRecord(value)?value.id:undefined);return ids.every(id=>typeof id==='string')&&new Set(ids).size===ids.length}
function onlyKeys(value:Record<string,unknown>,keys:readonly string[]):boolean{const allowed=new Set(keys);return Object.keys(value).every(key=>allowed.has(key))}
const IDENTITY_KEYS=['mission_id','session_id','objective','intent','semantic_assessment','status','risk','created_at','updated_at'] as const
const INTENT_KEYS=['objective','likelyTargets','taskKind','scope','risk','ambiguity','dependencyClass','requiredCapabilities','requestedExternalActions','likelyVerification','avoid'] as const
const SEMANTIC_ASSESSMENT_KEYS=['status','phase','revision','source','pending_text','assessed_at'] as const
const OBLIGATION_KINDS=new Set(['analysis','implementation','research','documentation','test-authoring','verification','review','authority'])
const OBLIGATION_STATUSES=new Set(['open','closed','blocked'])
const GATE_KINDS=new Set(['verification','user-authority','reviewer','prerequisite-task','precondition','rollback'])
const GATE_STATUSES=new Set(['open','ready','blocked','closed'])
function validObligation(value:unknown):boolean{
  if(!isRecord(value)||typeof value.id!=='string'||typeof value.status!=='string'||!OBLIGATION_STATUSES.has(value.status)||typeof value.kind!=='string'||!OBLIGATION_KINDS.has(value.kind)||typeof value.summary!=='string')return false
  if(value.requiredEvidence!==undefined&&(!stringArray(value.requiredEvidence)||!value.requiredEvidence.every(kind=>(SEMANTIC_VERIFICATION_KINDS as readonly string[]).includes(kind))))return false
  if(value.requiredTargets!==undefined&&(!stringArray(value.requiredTargets)||!['implementation','documentation','test-authoring'].includes(String(value.kind))||!value.requiredTargets.every(target=>normalizeBoundedProjectPath(target)===target)))return false
  if(value.blocker!==undefined&&typeof value.blocker!=='string')return false
  if(value.closedAt!==undefined&&typeof value.closedAt!=='number')return false
  return true
}
function validGate(value:unknown):boolean{
  return isRecord(value)&&typeof value.id==='string'&&typeof value.kind==='string'&&GATE_KINDS.has(value.kind)&&typeof value.summary==='string'&&typeof value.status==='string'&&GATE_STATUSES.has(value.status)&&(value.reason===undefined||typeof value.reason==='string')&&typeof value.updated_at==='number'
}
function validContextArtifact(value:unknown):boolean{
  if(!isRecord(value)||typeof value.id!=='string'||typeof value.kind!=='string'||typeof value.added_at!=='number')return false
  for(const field of ['uri','title','summary','sha256'] as const)if(value[field]!==undefined&&typeof value[field]!=='string')return false
  return true
}
function validTemporaryMutation(value:unknown):boolean{
  if(!isRecord(value)||typeof value.id!=='string'||typeof value.kind!=='string'||typeof value.description!=='string'||typeof value.rollback_command!=='string'||typeof value.rollback_hash!=='string'||!['active','rolled-back','failed'].includes(String(value.status))||typeof value.created_at!=='number')return false
  if(value.rollback_mode!==undefined&&!['command','native-revert'].includes(String(value.rollback_mode)))return false
  for(const field of ['session_id','message_id','detail'] as const)if(value[field]!==undefined&&typeof value[field]!=='string')return false
  return value.resolved_at===undefined||typeof value.resolved_at==='number'
}
function validMethodologyNeed(value:unknown):boolean{
  if(!isRecord(value)||typeof value.name!=='string'||!/^hi-[a-z0-9-]+$/.test(value.name))return false
  if(typeof value.signal!=='string'||!Object.prototype.hasOwnProperty.call(HI_METHODOLOGY_SIGNAL_CATALOG,value.signal))return false
  const signal=(HI_METHODOLOGY_SIGNAL_CATALOG as Record<string,{trigger_source:string;producers:readonly string[]}>)[value.signal]
  if(typeof value.trigger_source!=='string'||value.trigger_source!==signal.trigger_source||!(HI_METHODOLOGY_TRIGGER_SOURCES as readonly string[]).includes(value.trigger_source))return false
  if(typeof value.producer!=='string'||!signal.producers.includes(value.producer)||!(HI_METHODOLOGY_PRODUCERS as readonly string[]).includes(value.producer))return false
  if(value.task_id!==undefined&&typeof value.task_id!=='string')return false
  if(value.obligation_id!==undefined&&typeof value.obligation_id!=='string')return false
  return typeof value.reason==='string'&&typeof value.created_at==='number'
}
function validVerificationPolicy(value:unknown):boolean{
  if(!isRecord(value)||!stringArray(value.requiredKinds)||typeof value.requireFresh!=='boolean'||typeof value.requireReview!=='boolean'||typeof value.allowWorkerReportedEvidence!=='boolean')return false
  const allowed=new Set<string>(SEMANTIC_VERIFICATION_KINDS)
  return value.requiredKinds.every(kind=>allowed.has(kind))
}

function validSemanticAssessment(value:unknown):boolean{
  if(!isRecord(value)||!onlyKeys(value,SEMANTIC_ASSESSMENT_KEYS))return false
  return ['pending','assessed'].includes(String(value.status))&&['initial','followup'].includes(String(value.phase))&&typeof value.revision==='number'&&value.revision>=1&&value.source==='host-primary'&&typeof value.pending_text==='string'&&(value.assessed_at===undefined||typeof value.assessed_at==='number')
}

function validIntent(value:unknown):value is NormalizedMissionIntent{
  if(!isRecord(value)||!onlyKeys(value,INTENT_KEYS))return false
  return typeof value.objective==='string'
    &&['unclassified','implementation','bug-fix','diagnosis','review','performance','release-readiness'].includes(String(value.taskKind))
    &&['local','multi-file','repo-wide','external','multi-stream'].includes(String(value.scope))
    &&['low','medium','high','authority-boundary'].includes(String(value.risk))
    &&['none','resolvable','contract-critical'].includes(String(value.ambiguity))
    &&['independent','sequential','external-gated','unknown','independent-multi'].includes(String(value.dependencyClass))
    &&stringArray(value.requiredCapabilities)&&value.requiredCapabilities.every(x=>(SEMANTIC_CAPABILITIES as readonly string[]).includes(x))
    &&Array.isArray(value.requestedExternalActions)&&value.requestedExternalActions.every(isExternalActionType)
    &&stringArray(value.likelyVerification)&&value.likelyVerification.every(x=>(SEMANTIC_VERIFICATION_KINDS as readonly string[]).includes(x))
    &&stringArray(value.avoid)
    &&(value.likelyTargets===undefined||stringArray(value.likelyTargets))
}

export function validateTaskDAG(identity:Record<string,unknown>,execution:Record<string,unknown>):boolean{
  if(!Array.isArray(execution.tasks)||!Array.isArray(execution.workers))return false
  const tasks=execution.tasks as Array<Record<string,unknown>>,workers=execution.workers as Array<Record<string,unknown>>
  const missionID=String(identity.mission_id??''),taskIDs=tasks.map(t=>String(t.id??'')),workerIDs=workers.map(w=>String(w.id??''))
  if(new Set(taskIDs).size!==taskIDs.length||new Set(workerIDs).size!==workerIDs.length)return false
  const knownTasks=new Set(taskIDs),knownWorkers=new Set(workerIDs)
  for(const task of tasks){
    if(task.mission_id!==missionID)return false
    const id=String(task.id),dependencies=task.dependencies as unknown[]
    if(!Array.isArray(dependencies)||dependencies.some(dep=>typeof dep!=='string'||dep===id||!knownTasks.has(dep)))return false
    if(task.worker_id!==undefined){
      if(typeof task.worker_id!=='string'||!knownWorkers.has(task.worker_id))return false
      const worker=workers.find(w=>w.id===task.worker_id)
      if(!worker||worker.task_id!==id)return false
    }
  }
  const visiting=new Set<string>(),visited=new Set<string>(),byID=new Map(tasks.map(t=>[String(t.id),t]))
  const cyclic=(id:string):boolean=>{
    if(visiting.has(id))return true
    if(visited.has(id))return false
    visiting.add(id)
    const task=byID.get(id)!,dependencies=task.dependencies as string[]
    for(const dep of dependencies)if(cyclic(dep))return true
    visiting.delete(id);visited.add(id);return false
  }
  for(const id of taskIDs)if(cyclic(id))return false
  const missionSessionID=String(identity.session_id??''),nativeSessionIDs:string[]=[]
  for(const worker of workers){
    if(worker.parent_mission_id!==missionID||worker.parent_session_id!==missionSessionID||typeof worker.task_id!=='string'||!knownTasks.has(worker.task_id))return false
    const ownerTask=byID.get(worker.task_id)
    if(!ownerTask||ownerTask.worker_id!==worker.id)return false
    if(worker.session_id!==undefined){if(typeof worker.session_id!=='string'||!worker.session_id)return false;nativeSessionIDs.push(worker.session_id)}
  }
  if(new Set(nativeSessionIDs).size!==nativeSessionIDs.length)return false
  if(!['single','parallel','team'].includes(String(execution.execution_mode)))return false
  if(!isRecord(execution.topology)||!['single-agent','multi-agent'].includes(String(execution.topology.mode))||!Number.isInteger(execution.topology.parallelism)||Number(execution.topology.parallelism)<1||Number(execution.topology.parallelism)>8||!stringArray(execution.topology.reason))return false
  if(execution.execution_mode==='single'&&execution.topology.parallelism!==1)return false
  return true
}

export function validateMissionIdentityState(identity:unknown):boolean{
  if(!isRecord(identity)||!onlyKeys(identity,IDENTITY_KEYS)||typeof identity.mission_id!=='string'||typeof identity.session_id!=='string'||typeof identity.objective!=='string')return false
  if(!validIntent(identity.intent)||!validSemanticAssessment(identity.semantic_assessment))return false
  if(!['active','waiting-user','stopped','completed','failed'].includes(String(identity.status)))return false
  if(!['low','medium','high','authority-boundary'].includes(String(identity.risk)))return false
  return typeof identity.created_at==='number'&&typeof identity.updated_at==='number'
}

export function validateMissionExecutionState(identity:unknown,execution:unknown,methodology:unknown):boolean{
  if(!isRecord(identity)||!isRecord(execution)||!isRecord(methodology)||!validVerificationPolicy(execution.verification_policy))return false
  if((identity.semantic_assessment as any)?.status==='assessed'&&(identity.intent as any)?.taskKind==='unclassified')return false
  if((identity.semantic_assessment as any)?.status==='pending'&&(identity.semantic_assessment as any)?.phase==='initial'&&(((execution.obligations as unknown[])?.length??0)>0||((execution.tasks as unknown[])?.length??0)>0||((execution.workers as unknown[])?.length??0)>0||((execution.processes as unknown[])?.length??0)>0||((execution.isolation_decisions as unknown[])?.length??0)>0||((execution.workspace_leases as unknown[])?.length??0)>0||((methodology.methodology_needs as unknown[])?.length??0)>0))return false
  if((!Array.isArray(execution.obligations)||!execution.obligations.every(validObligation)||!uniqueRecordIDs(execution.obligations))||!Array.isArray(execution.tasks)||!execution.tasks.every(isTaskContract)||!Array.isArray(execution.workers)||!execution.workers.every(isWorkerContract)||!Array.isArray(execution.processes)||!execution.processes.every(isProcessContract)||!Array.isArray(execution.isolation_decisions)||!execution.isolation_decisions.every(isIsolationDecisionContract)||!Array.isArray(execution.workspace_leases)||!execution.workspace_leases.every(isWorkspaceLeaseContract)||!recordArray(execution.ledger))return false
  if(!stringArray(execution.blockers)||!stringArray(execution.constraints)||(execution.constraint_atoms!==undefined&&(!Array.isArray(execution.constraint_atoms)||!execution.constraint_atoms.every(isConstraintAtom)))||typeof execution.native_todos_incomplete!=='number'||!Array.isArray(execution.gates)||!execution.gates.every(validGate)||!uniqueRecordIDs(execution.gates))return false
  if(Array.isArray(execution.constraint_atoms)){
    const atoms=execution.constraint_atoms as any[],ids=atoms.map(a=>a.id);if(new Set(ids).size!==ids.length)return false
    const known=new Set(ids);for(const atom of atoms){if(atom.superseded_by!==undefined&&!known.has(atom.superseded_by))return false;if((atom.supersedes??[]).some((id:string)=>!known.has(id)))return false;if(atom.status==='SUPERSEDED'&&!atom.superseded_by)return false;if(atom.status==='ACTIVE'&&atom.superseded_by!==undefined)return false}
  }
  if(execution.scheduler!==undefined){
    if(!isSchedulerLifecycleState(execution.scheduler)||execution.scheduler.missionId!==identity.mission_id)return false
    const tasks=execution.tasks as any[],workers=execution.workers as any[]
    for(const reservation of execution.scheduler.reservations){
      const task=tasks.find(task=>task.id===reservation.workNodeId),worker=workers.find(worker=>worker.id===reservation.workerId)
      if(!task||!worker||worker.task_id!==task.id||reservation.executionUnitId!==`eu:${task.id}`)return false
    }
  }
  const processIDs=new Set<string>();for(const process of execution.processes as any[]){if(processIDs.has(process.process_id))return false;processIDs.add(process.process_id);if(process.mission_id!==identity.mission_id)return false;const task=(execution.tasks as any[]).find(t=>t.id===process.task_id),worker=(execution.workers as any[]).find(w=>w.id===process.worker_id);if(!task||!worker||worker.task_id!==task.id)return false}
  const leaseIDs=new Set<string>(),activeWorkspacePaths=new Set<string>(),activeHostWorkspaceIDs=new Set<string>();for(const lease of execution.workspace_leases as any[]){if(leaseIDs.has(lease.lease_id))return false;leaseIDs.add(lease.lease_id);if(lease.mission_id!==identity.mission_id)return false;if(!(execution.tasks as any[]).some(t=>t.id===lease.task_id))return false;if(lease.status!=='CLOSED'){if(activeWorkspacePaths.has(lease.workspace_path))return false;activeWorkspacePaths.add(lease.workspace_path);if(lease.host_workspace_id){if(activeHostWorkspaceIDs.has(lease.host_workspace_id))return false;activeHostWorkspaceIDs.add(lease.host_workspace_id)}}}
  return isRecord(execution.evidence)&&typeof execution.evidence.fresh==='boolean'&&Array.isArray(execution.evidence.items)&&execution.evidence.items.every(isEvidenceItemContract)&&uniqueRecordIDs(execution.evidence.items)&&execution.evidence.fresh===hasFreshPassedEvidence(execution.evidence.items as any[])&&(execution.evidence.last_mutation_at===undefined||typeof execution.evidence.last_mutation_at==='number')
}

export function validateContinuationState(continuation:unknown):boolean{
  if(!isRecord(continuation)||typeof continuation.generation!=='number'||typeof continuation.iteration!=='number'||typeof continuation.continuation_budget!=='number'||typeof continuation.continuation_active!=='boolean')return false
  if(typeof continuation.last_progress_signature!=='string'||typeof continuation.stagnation_count!=='number'||typeof continuation.user_interrupted!=='boolean'||typeof continuation.resume_count!=='number')return false
  for(const field of ['suppress_until','continuation_lock_until','last_continuation_at','continuation_failure_count','last_continuation_failure_at','interrupted_at','resumed_at','last_user_message_at'] as const)if(continuation[field]!==undefined&&typeof continuation[field]!=='number')return false
  for(const field of ['continuation_reason','last_action_id','active_action_id','interrupted_reason'] as const)if(continuation[field]!==undefined&&typeof continuation[field]!=='string')return false
  if(continuation.semantic_progress_snapshot!==undefined&&!isSemanticProgressSnapshot(continuation.semantic_progress_snapshot))return false
  if(continuation.last_progress_delta!==undefined&&!isProgressDelta(continuation.last_progress_delta))return false
  if(continuation.recovery_history!==undefined&&(!Array.isArray(continuation.recovery_history)||continuation.recovery_history.length>24||!continuation.recovery_history.every(isRecoveryStrategyRecord)))return false
  return continuation.pending_nudge===undefined||isRecord(continuation.pending_nudge)
}

export function validateContextState(context:unknown):boolean{return isRecord(context)&&Array.isArray(context.context_artifacts)&&context.context_artifacts.every(validContextArtifact)&&uniqueRecordIDs(context.context_artifacts)}

export function validateVcsSafetyState(vcs:unknown):boolean{
  if(!isRecord(vcs)||!stringArray(vcs.changed_files)||!Array.isArray(vcs.temporary_mutations)||!vcs.temporary_mutations.every(validTemporaryMutation)||!uniqueRecordIDs(vcs.temporary_mutations))return false
  if(vcs.preexisting_user_changes!==undefined&&!isRecord(vcs.preexisting_user_changes))return false
  if(vcs.preexisting_user_baseline_captured!==undefined&&typeof vcs.preexisting_user_baseline_captured!=='boolean')return false
  return vcs.git_topology_owned_files===undefined||stringArray(vcs.git_topology_owned_files)
}

export function validateAuthorityState(authority:unknown):boolean{
  if(!isRecord(authority)||typeof authority.pending_permissions!=='number'||!stringArray(authority.pending_permission_ids))return false
  if(authority.human_decision!==undefined&&!isHumanDecisionContract(authority.human_decision))return false
  if(authority.authority!==undefined&&!isAuthorityStateContract(authority.authority))return false
  return authority.applied_actions===undefined||isRecord(authority.applied_actions)
}

export function validateReleaseState(release:unknown):boolean{return isRecord(release)&&(release.release_chain===undefined||isRecord(release.release_chain))}

export function validateMethodologyState(methodology:unknown):boolean{return isRecord(methodology)&&Array.isArray(methodology.methodology_needs)&&methodology.methodology_needs.every(validMethodologyNeed)&&stringArray(methodology.parent_loaded_methodologies)}

export function validateMissionEnvelope(value:unknown):value is MissionState{
  if(!isRecord(value))return false
  const topKeys=Object.keys(value).sort(),expected=['authority','context','continuation','execution','identity','methodology','release','vcs']
  if(topKeys.length!==expected.length||topKeys.some((key,index)=>key!==expected[index]))return false
  const {identity,execution,continuation,context,vcs,authority,release,methodology}=value
  if(!validateMissionIdentityState(identity)||!validateMissionExecutionState(identity,execution,methodology)||!validateContinuationState(continuation)||!validateContextState(context)||!validateVcsSafetyState(vcs)||!validateAuthorityState(authority)||!validateReleaseState(release)||!validateMethodologyState(methodology))return false
  return isRecord(identity)&&isRecord(execution)&&validateTaskDAG(identity,execution)
}
