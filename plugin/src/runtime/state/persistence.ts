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
        if(!validateMissionEnvelope(mission))throw new Error(`invalid mission state at index ${index}`)
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
