import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { runtimeStatePath } from '../storage/locations.js'
import { type MissionState, type NormalizedMissionIntent } from '../mission/types.js'
import { isEvidenceItemContract } from '../../contracts/evidence.js'
import { isTaskContract } from '../../contracts/task.js'
import { isWorkerContract } from '../../contracts/worker.js'
import { isHumanDecisionContract } from '../../contracts/human-decision.js'
import { isAuthorityStateContract } from '../../contracts/authority.js'
import { isExternalActionType } from '../../contracts/external-action.js'
import { HI_METHODOLOGY_PRODUCERS, HI_METHODOLOGY_SIGNAL_CATALOG, HI_METHODOLOGY_TRIGGER_SOURCES } from '../../generated/methodology-policy.js'
import { SEMANTIC_CAPABILITIES, SEMANTIC_VERIFICATION_KINDS } from '../intent/semantic-assessment.js'

export const RUNTIME_STATE_SCHEMA = 8 as const

interface RuntimeEnvelope {
  boot_id:string
  started_at:number
  clean_shutdown:boolean
  last_saved_at:number
  previous_boot_id?:string
}

interface PersistedRuntimeState {
  schema:typeof RUNTIME_STATE_SCHEMA
  updated_at:number
  runtime:RuntimeEnvelope
  missions:MissionState[]
}

export interface PersistenceLoadReport {
  sourceSchema?:number
  targetSchema:typeof RUNTIME_STATE_SCHEMA
  loaded:number
  error?:string
  previousBootId?:string
  uncleanShutdown?:boolean
}

function isRecord(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value)}
function stringArray(value:unknown):value is string[]{return Array.isArray(value)&&value.every(item=>typeof item==='string')}
function recordArray(value:unknown):value is Record<string,unknown>[]{return Array.isArray(value)&&value.every(isRecord)}
const OBLIGATION_KINDS=new Set(['analysis','implementation','verification','review','authority'])
const OBLIGATION_STATUSES=new Set(['open','closed','blocked'])
const GATE_KINDS=new Set(['verification','user-authority','reviewer','prerequisite-task','precondition','rollback'])
const GATE_STATUSES=new Set(['open','ready','blocked','closed'])
function validObligation(value:unknown):boolean{
  if(!isRecord(value)||typeof value.id!=='string'||typeof value.status!=='string'||!OBLIGATION_STATUSES.has(value.status)||typeof value.kind!=='string'||!OBLIGATION_KINDS.has(value.kind)||typeof value.summary!=='string')return false
  if(value.requiredEvidence!==undefined&&(!stringArray(value.requiredEvidence)||!value.requiredEvidence.every(kind=>(SEMANTIC_VERIFICATION_KINDS as readonly string[]).includes(kind))))return false
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
  if(!isRecord(value))return false
  return ['pending','assessed'].includes(String(value.status))&&['initial','followup'].includes(String(value.phase))&&typeof value.revision==='number'&&value.revision>=1&&value.source==='host-primary'&&typeof value.pending_text==='string'&&(value.assessed_at===undefined||typeof value.assessed_at==='number')
}

function validIntent(value:unknown):value is NormalizedMissionIntent{
  if(!isRecord(value))return false
  return typeof value.objective==='string'
    &&['unclassified','implementation','bug-fix','review','performance','release-readiness'].includes(String(value.taskKind))
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

function validMissionTrajectory(identity:Record<string,unknown>,execution:Record<string,unknown>):boolean{
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
  for(const worker of workers){
    if(worker.parent_mission_id!==missionID||typeof worker.task_id!=='string'||!knownTasks.has(worker.task_id))return false
  }
  if(!['single','parallel','team'].includes(String(execution.execution_mode)))return false
  if(!isRecord(execution.topology)||!['single-agent','multi-agent'].includes(String(execution.topology.mode))||!Number.isInteger(execution.topology.parallelism)||Number(execution.topology.parallelism)<1||Number(execution.topology.parallelism)>8||!stringArray(execution.topology.reason))return false
  if(execution.execution_mode==='single'&&execution.topology.parallelism!==1)return false
  return true
}

function validMission(value:unknown):value is MissionState{
  if(!isRecord(value))return false
  const topKeys=Object.keys(value).sort()
  const expected=['authority','context','continuation','execution','identity','methodology','release','vcs']
  if(topKeys.length!==expected.length||topKeys.some((key,index)=>key!==expected[index]))return false
  const {identity,execution,continuation,context,vcs,authority,release,methodology}=value
  if(!isRecord(identity)||!isRecord(execution)||!isRecord(continuation)||!isRecord(context)||!isRecord(vcs)||!isRecord(authority)||!isRecord(release)||!isRecord(methodology))return false

  if(typeof identity.mission_id!=='string'||typeof identity.session_id!=='string'||typeof identity.objective!=='string')return false
  if(!validIntent(identity.intent)||!validSemanticAssessment(identity.semantic_assessment))return false
  if(!['active','waiting-user','stopped','completed','failed'].includes(String(identity.status)))return false
  if(!['low','medium','high','authority-boundary'].includes(String(identity.risk)))return false
  if(typeof identity.created_at!=='number'||typeof identity.updated_at!=='number')return false

  if(!validVerificationPolicy(execution.verification_policy))return false
  if((identity.semantic_assessment as any).status==='assessed'&&(identity.intent as any).taskKind==='unclassified')return false
  if((identity.semantic_assessment as any).status==='pending'&&(identity.semantic_assessment as any).phase==='initial'&&(((execution.obligations as unknown[])?.length??0)>0||((execution.tasks as unknown[])?.length??0)>0||((execution.workers as unknown[])?.length??0)>0||((methodology.methodology_needs as unknown[])?.length??0)>0))return false
  if((!Array.isArray(execution.obligations)||!execution.obligations.every(validObligation))||!Array.isArray(execution.tasks)||!execution.tasks.every(isTaskContract)||!Array.isArray(execution.workers)||!execution.workers.every(isWorkerContract)||!recordArray(execution.ledger))return false
  if(!validMissionTrajectory(identity,execution))return false
  if(!stringArray(execution.blockers)||!stringArray(execution.constraints)||typeof execution.native_todos_incomplete!=='number'||!Array.isArray(execution.gates)||!execution.gates.every(validGate))return false
  if(!isRecord(execution.evidence)||typeof execution.evidence.fresh!=='boolean'||!Array.isArray(execution.evidence.items)||!execution.evidence.items.every(isEvidenceItemContract)||(execution.evidence.last_mutation_at!==undefined&&typeof execution.evidence.last_mutation_at!=='number'))return false

  if(typeof continuation.generation!=='number'||typeof continuation.iteration!=='number'||typeof continuation.continuation_budget!=='number'||typeof continuation.continuation_active!=='boolean')return false
  if(typeof continuation.last_progress_signature!=='string'||typeof continuation.stagnation_count!=='number'||typeof continuation.user_interrupted!=='boolean'||typeof continuation.resume_count!=='number')return false
  for(const field of ['suppress_until','continuation_lock_until','last_continuation_at','continuation_failure_count','last_continuation_failure_at','interrupted_at','resumed_at','last_user_message_at'] as const)if(continuation[field]!==undefined&&typeof continuation[field]!=='number')return false
  for(const field of ['continuation_reason','last_action_id','active_action_id','interrupted_reason'] as const)if(continuation[field]!==undefined&&typeof continuation[field]!=='string')return false
  if(continuation.pending_nudge!==undefined&&!isRecord(continuation.pending_nudge))return false

  if(!Array.isArray(context.context_artifacts)||!context.context_artifacts.every(validContextArtifact))return false
  if(!stringArray(vcs.changed_files)||!Array.isArray(vcs.temporary_mutations)||!vcs.temporary_mutations.every(validTemporaryMutation))return false
  if(vcs.preexisting_user_changes!==undefined&&!isRecord(vcs.preexisting_user_changes))return false
  if(vcs.preexisting_user_baseline_captured!==undefined&&typeof vcs.preexisting_user_baseline_captured!=='boolean')return false
  if(vcs.git_topology_owned_files!==undefined&&!stringArray(vcs.git_topology_owned_files))return false

  if(typeof authority.pending_permissions!=='number'||!stringArray(authority.pending_permission_ids))return false
  if(authority.human_decision!==undefined&&!isHumanDecisionContract(authority.human_decision))return false
  if(authority.authority!==undefined&&!isAuthorityStateContract(authority.authority))return false
  if(authority.applied_actions!==undefined&&!isRecord(authority.applied_actions))return false

  if(release.release_chain!==undefined&&!isRecord(release.release_chain))return false
  if(!Array.isArray(methodology.methodology_needs)||!methodology.methodology_needs.every(validMethodologyNeed)||!stringArray(methodology.parent_loaded_methodologies))return false
  return true
}

function bootID():string{return `boot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`}

export class RuntimePersistence {
  readonly path:string
  readonly bootId:string=bootID()
  readonly startedAt:number=Date.now()
  previousBootId?:string
  lastLoadReport:PersistenceLoadReport={targetSchema:RUNTIME_STATE_SCHEMA,loaded:0}

  constructor(projectRoot:string){this.path=runtimeStatePath(projectRoot)}

  load():MissionState[]{
    if(!existsSync(this.path)){this.lastLoadReport={targetSchema:RUNTIME_STATE_SCHEMA,loaded:0};return[]}
    try{
      const parsed=JSON.parse(readFileSync(this.path,'utf8')) as unknown
      if(!isRecord(parsed))throw new Error('runtime state is not an object')
      const schema=Number(parsed.schema)
      if(schema!==RUNTIME_STATE_SCHEMA)throw new Error(`unsupported runtime-state schema ${String(parsed.schema)}`)
      if(!Array.isArray(parsed.missions))throw new Error('missions is not an array')
      const missions:MissionState[]=[]
      for(let index=0;index<parsed.missions.length;index++){
        const mission=parsed.missions[index]
        if(!validMission(mission))throw new Error(`invalid mission state at index ${index}`)
        missions.push(mission)
      }
      const runtime=parsed.runtime
      if(!isRecord(runtime)||typeof runtime.boot_id!=='string'||typeof runtime.clean_shutdown!=='boolean')throw new Error('runtime envelope invalid')
      this.previousBootId=runtime.boot_id
      this.lastLoadReport={sourceSchema:schema,targetSchema:RUNTIME_STATE_SCHEMA,loaded:missions.length,previousBootId:runtime.boot_id,uncleanShutdown:runtime.clean_shutdown===false}
      return missions
    }catch(error){
      this.lastLoadReport={targetSchema:RUNTIME_STATE_SCHEMA,loaded:0,error:String(error)}
      return[]
    }
  }

  save(missions:MissionState[],cleanShutdown=false):void{
    mkdirSync(dirname(this.path),{recursive:true,mode:0o700})
    const now=Date.now()
    const payload:PersistedRuntimeState={schema:RUNTIME_STATE_SCHEMA,updated_at:now,runtime:{boot_id:this.bootId,started_at:this.startedAt,clean_shutdown:cleanShutdown,last_saved_at:now,previous_boot_id:this.previousBootId},missions}
    const tmp=`${this.path}.tmp`
    writeFileSync(tmp,`${JSON.stringify(payload,null,2)}\n`,{encoding:'utf8',mode:0o600})
    renameSync(tmp,this.path)
  }

  markRunning(missions:MissionState[]):void{this.save(missions,false)}
  markCleanShutdown(missions:MissionState[]):void{this.save(missions,true)}
}
