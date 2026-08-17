import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { runtimeStatePath } from '../storage/locations.js'
import type { MissionState } from '../mission/types.js'
import { validateMissionEnvelope } from '../mission/validators.js'

export const RUNTIME_STATE_SCHEMA = 10 as const

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

const STATE_KEYS=new Set(['schema','updated_at','runtime','missions'])
const RUNTIME_KEYS=new Set(['boot_id','started_at','clean_shutdown','last_saved_at','previous_boot_id'])
function finiteTimestamp(value:unknown):value is number{return typeof value==='number'&&Number.isFinite(value)&&value>0}

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
      if(Object.keys(parsed).some(key=>!STATE_KEYS.has(key))||Object.keys(parsed).length!==STATE_KEYS.size)throw new Error('runtime state envelope keys invalid')
      if(!finiteTimestamp(parsed.updated_at))throw new Error('runtime state updated_at invalid')
      const schema=Number(parsed.schema)
      if(schema!==RUNTIME_STATE_SCHEMA)throw new Error(`unsupported runtime-state schema ${String(parsed.schema)}`)
      if(!Array.isArray(parsed.missions))throw new Error('missions is not an array')
      const missions:MissionState[]=[],sessionIDs=new Set<string>(),missionIDs=new Set<string>()
      for(let index=0;index<parsed.missions.length;index++){
        const mission=parsed.missions[index]
        if(!validateMissionEnvelope(mission))throw new Error(`invalid mission state at index ${index}`)
        if(sessionIDs.has(mission.identity.session_id))throw new Error(`duplicate persisted session identity ${mission.identity.session_id}`)
        if(missionIDs.has(mission.identity.mission_id))throw new Error(`duplicate persisted mission identity ${mission.identity.mission_id}`)
        sessionIDs.add(mission.identity.session_id);missionIDs.add(mission.identity.mission_id);missions.push(mission)
      }
      const runtime=parsed.runtime
      if(!isRecord(runtime)||Object.keys(runtime).some(key=>!RUNTIME_KEYS.has(key))||!['boot_id','started_at','clean_shutdown','last_saved_at'].every(key=>Object.prototype.hasOwnProperty.call(runtime,key))||typeof runtime.boot_id!=='string'||!runtime.boot_id||typeof runtime.clean_shutdown!=='boolean'||!finiteTimestamp(runtime.started_at)||!finiteTimestamp(runtime.last_saved_at)||(runtime.previous_boot_id!==undefined&&(typeof runtime.previous_boot_id!=='string'||!runtime.previous_boot_id)))throw new Error('runtime envelope invalid')
      this.previousBootId=runtime.boot_id
      this.lastLoadReport={sourceSchema:schema,targetSchema:RUNTIME_STATE_SCHEMA,loaded:missions.length,previousBootId:runtime.boot_id,uncleanShutdown:runtime.clean_shutdown===false}
      return missions
    }catch(error){
      this.lastLoadReport={targetSchema:RUNTIME_STATE_SCHEMA,loaded:0,error:String(error)}
      return[]
    }
  }

  save(missions:MissionState[],cleanShutdown=false):void{
    const sessionIDs=new Set<string>(),missionIDs=new Set<string>()
    for(let index=0;index<missions.length;index++){const mission=missions[index],sessionID=mission?.identity?.session_id,missionID=mission?.identity?.mission_id;if(typeof sessionID==='string'&&sessionIDs.has(sessionID))throw new Error(`refusing to persist duplicate session identity ${sessionID}`);if(typeof missionID==='string'&&missionIDs.has(missionID))throw new Error(`refusing to persist duplicate mission identity ${missionID}`);if(!validateMissionEnvelope(mission))throw new Error(`refusing to persist invalid mission state at index ${index}`);sessionIDs.add(mission.identity.session_id);missionIDs.add(mission.identity.mission_id)}
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
