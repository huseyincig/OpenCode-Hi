import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { runtimeStatePath } from '../storage/locations.js'
import type { MissionState } from '../mission/types.js'
import { verificationPolicyFor } from '../verification/policy.js'

export const RUNTIME_STATE_SCHEMA = 3 as const
interface RuntimeEnvelope { boot_id:string; started_at:number; clean_shutdown:boolean; last_saved_at:number; previous_boot_id?:string }
interface PersistedRuntimeStateV3 { schema:typeof RUNTIME_STATE_SCHEMA; updated_at:number; runtime:RuntimeEnvelope; missions:MissionState[] }
export interface PersistenceLoadReport {
  sourceSchema?:number
  targetSchema:typeof RUNTIME_STATE_SCHEMA
  loaded:number
  ignored:number
  error?:string
  previousBootId?:string
  uncleanShutdown?:boolean
  migrated?:boolean
}

function normalizeMission(raw:any):MissionState|undefined{
  if(!raw||typeof raw!=='object'||typeof raw.session_id!=='string'||typeof raw.mission_id!=='string'||!raw.intent)return undefined
  const m=raw as MissionState
  m.obligations=Array.isArray(m.obligations)?m.obligations:[];m.tasks=Array.isArray(m.tasks)?m.tasks:[];m.workers=Array.isArray(m.workers)?m.workers:[];for(const w of m.workers){w.loaded_skills=Array.isArray(w.loaded_skills)?w.loaded_skills:[];w.methodologies=Array.isArray(w.methodologies)?w.methodologies:[];w.write_set=Array.isArray(w.write_set)?w.write_set:[];w.restart_reconcile_pending=Boolean(w.restart_reconcile_pending)}
  m.evidence=m.evidence&&Array.isArray(m.evidence.items)?m.evidence:{fresh:false,items:[]};m.ledger=Array.isArray(m.ledger)?m.ledger:[];m.changed_files=Array.isArray(m.changed_files)?m.changed_files:[];m.preexisting_user_changes=m.preexisting_user_changes&&typeof m.preexisting_user_changes==='object'?m.preexisting_user_changes:{};m.preexisting_user_baseline_captured=Boolean(m.preexisting_user_baseline_captured||Object.keys(m.preexisting_user_changes).length);m.staging_safety=undefined;m.git_topology_safety=undefined;m.git_topology_pending=undefined;m.git_topology_owned_files=Array.isArray(m.git_topology_owned_files)?m.git_topology_owned_files:[];m.blockers=Array.isArray(m.blockers)?m.blockers:[]
  m.verification_policy=m.verification_policy??verificationPolicyFor(m.intent);m.generation=Math.max(1,Number(m.generation)||1);m.continuation_active=Boolean(m.continuation_active);m.context_artifacts=Array.isArray(m.context_artifacts)?m.context_artifacts:[];m.gates=Array.isArray(m.gates)?m.gates:[];m.temporary_mutations=Array.isArray(m.temporary_mutations)?m.temporary_mutations:[];m.parent_loaded_skills=Array.isArray(m.parent_loaded_skills)?m.parent_loaded_skills:[];m.pending_permissions=Number.isFinite(m.pending_permissions)?m.pending_permissions:0;m.pending_permission_ids=Array.isArray(m.pending_permission_ids)?m.pending_permission_ids:[];(m.intent as any).dependencyClass??='unknown';for(const w of m.workers){w.runtime_recovery_pending=false;w.runtime_recovery_attempt=Number.isFinite(w.runtime_recovery_attempt)?w.runtime_recovery_attempt:0;w.runtime_fallback_exhausted=Boolean(w.runtime_fallback_exhausted)}for(const t of m.tasks){t.context_artifacts=Array.isArray(t.context_artifacts)?t.context_artifacts:[];t.gate_ids=Array.isArray(t.gate_ids)?t.gate_ids:[];if(t.execution_profile){(t.execution_profile as any).task??={objective:t.objective,scope:[...(t.scope??[])],dependencies:[...(t.dependencies??[])],required_evidence:[...(t.requiredEvidence??[])]};(t.execution_profile as any).tools=Array.isArray((t.execution_profile as any).tools)?(t.execution_profile as any).tools:[];(t.execution_profile as any).permission_profile??={skill_tool_enabled:true,skill_permissions:{},external_effects:'parent-only',recursive_task:'deny'};(t.execution_profile as any).verification_policy??={...m.verification_policy,requiredKinds:[...m.verification_policy.requiredKinds]}}}m.user_interrupted=Boolean(m.user_interrupted);m.resume_count=Number.isFinite(m.resume_count)?m.resume_count:0;m.native_todos_incomplete=Number.isFinite(m.native_todos_incomplete)?m.native_todos_incomplete:0;m.stagnation_count=Number.isFinite(m.stagnation_count)?m.stagnation_count:0;m.iteration=Number.isFinite(m.iteration)?m.iteration:0
  return m
}

function bootID():string{return `boot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`}

export class RuntimePersistence {
  readonly path:string
  readonly bootId:string=bootID()
  readonly startedAt:number=Date.now()
  previousBootId?:string
  lastLoadReport:PersistenceLoadReport={targetSchema:RUNTIME_STATE_SCHEMA,loaded:0,ignored:0}
  constructor(projectRoot:string){this.path=runtimeStatePath(projectRoot)}
  load():MissionState[]{
    if(!existsSync(this.path)){this.lastLoadReport={targetSchema:RUNTIME_STATE_SCHEMA,loaded:0,ignored:0};return[]}
    try{
      const parsed=JSON.parse(readFileSync(this.path,'utf8')) as Partial<PersistedRuntimeStateV3>;const schema=Number(parsed.schema);if(!Array.isArray(parsed.missions))throw new Error('missions is not an array')
      if(schema!==RUNTIME_STATE_SCHEMA)throw new Error(`unsupported runtime-state schema ${String(parsed.schema)}`)
      const out:MissionState[]=[];let ignored=0
      for(const raw of parsed.missions){const m=normalizeMission(raw);if(m)out.push(m);else ignored++}
      const runtime=(parsed as PersistedRuntimeStateV3).runtime
      this.previousBootId=runtime?.boot_id
      this.lastLoadReport={sourceSchema:schema,targetSchema:RUNTIME_STATE_SCHEMA,loaded:out.length,ignored,previousBootId:runtime?.boot_id,uncleanShutdown:runtime?runtime.clean_shutdown===false:undefined,migrated:false}
      return out
    }catch(error){this.lastLoadReport={targetSchema:RUNTIME_STATE_SCHEMA,loaded:0,ignored:0,error:String(error)};return[]}
  }
  save(missions:MissionState[], cleanShutdown=false):void{
    mkdirSync(dirname(this.path),{recursive:true});const now=Date.now();const payload:PersistedRuntimeStateV3={schema:RUNTIME_STATE_SCHEMA,updated_at:now,runtime:{boot_id:this.bootId,started_at:this.startedAt,clean_shutdown:cleanShutdown,last_saved_at:now,previous_boot_id:this.previousBootId},missions};const tmp=`${this.path}.tmp`;writeFileSync(tmp,`${JSON.stringify(payload,null,2)}\n`,'utf8');renameSync(tmp,this.path)
  }
  markRunning(missions:MissionState[]):void{this.save(missions,false)}
  markCleanShutdown(missions:MissionState[]):void{this.save(missions,true)}
}
