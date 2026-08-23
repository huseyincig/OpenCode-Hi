import {existsSync,mkdirSync,openSync,closeSync,readFileSync,renameSync,rmSync,writeFileSync} from "node:fs"
import {dirname,join} from "node:path"
import {MODEL_ROUTED_CHILD_ROLES,isModelRoutedChildRole,type ModelRoutedChildRole,type TopologyMode} from "./schema.js"

export type HiWorkMode="adaptive"|"single"|"multi"
export interface ProjectSettingsPatch{
  workMode?:HiWorkMode
  maxAgents?:number
  parallelism?:number
  allowedModels?:string[]|null
  roleModels?:Partial<Record<ModelRoutedChildRole,string[]|null>>
  resetRoleModels?:boolean
}

export interface ProjectSettingsResult{
  path:string
  workMode:HiWorkMode
  execution:{topology:TopologyMode;maxAgents?:number;parallelism?:number}
  roleModels:Record<string,string[]>
  allowedModels:string[]
}

export function projectSettingsPath(projectRoot:string){return join(projectRoot,".opencode","hi","policy","routing.json")}
export function hasProjectSettings(projectRoot:string){return existsSync(projectSettingsPath(projectRoot))}
function record(value:unknown):value is Record<string,any>{return Boolean(value)&&typeof value==="object"&&!Array.isArray(value)}
function uniqueModels(value:unknown):string[]{if(!Array.isArray(value))return[];return[...new Set(value.map(String).map(x=>x.trim()).filter(Boolean))]}
function boundedInteger(value:unknown,name:string):number|undefined{
  if(value===undefined)return undefined
  if(!Number.isInteger(value)||Number(value)<1||Number(value)>8)throw new Error(`${name} must be an integer in 1..8`)
  return Number(value)
}
function workModeFromTopology(value:unknown):HiWorkMode{return value==="single-agent"?"single":value==="multi-agent"?"multi":"adaptive"}
function topologyFromWorkMode(value:HiWorkMode):TopologyMode{return value==="single"?"single-agent":value==="multi"?"multi-agent":"adaptive"}

export function readProjectSettingsDocument(projectRoot:string):{path:string;doc:Record<string,any>}{
  const path=projectSettingsPath(projectRoot)
  if(!existsSync(path))return{path,doc:{schema:1,type:"hi-routing",routing:{}}}
  let doc:any
  try{doc=JSON.parse(readFileSync(path,"utf8"))}catch(error){throw new Error(`Cannot read Hi project settings: ${String(error)}`)}
  if(!record(doc)||doc.schema!==1||doc.type!=="hi-routing")throw new Error("Cannot update Hi project settings: unsupported routing shape")
  if(doc.routing!==undefined&&!record(doc.routing))throw new Error("Cannot update Hi project settings: routing must be an object")
  if(doc.execution!==undefined&&!record(doc.execution))throw new Error("Cannot update Hi project settings: execution must be an object")
  return{path,doc}
}

function atomicWrite(path:string,text:string){
  mkdirSync(dirname(path),{recursive:true})
  const tmp=`${path}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`
  let fd:number|undefined
  try{fd=openSync(tmp,"wx");writeFileSync(fd,text,"utf8");closeSync(fd);fd=undefined;renameSync(tmp,path)}
  finally{if(fd!==undefined)try{closeSync(fd)}catch{};if(existsSync(tmp))try{rmSync(tmp,{force:true})}catch{}}
}

export function applyProjectSettings(projectRoot:string,patch:ProjectSettingsPatch):ProjectSettingsResult{
  if(!record(patch))throw new Error("Hi settings patch must be an object")
  if(patch.workMode!==undefined&&!(["adaptive","single","multi"] as const).includes(patch.workMode))throw new Error("workMode must be adaptive, single, or multi")
  const normalizedAllowedModels=patch.allowedModels===null?[]:patch.allowedModels===undefined?undefined:uniqueModels(patch.allowedModels)
  if(patch.allowedModels!==undefined&&patch.allowedModels!==null&&!Array.isArray(patch.allowedModels))throw new Error("allowedModels must be an array or null")
  if(Array.isArray(patch.allowedModels)&&!normalizedAllowedModels?.length)throw new Error("allowedModels cannot be empty; use null to clear the pool")
  const maxAgents=boundedInteger(patch.maxAgents,"maxAgents"),parallelism=boundedInteger(patch.parallelism,"parallelism")
  if(patch.roleModels!==undefined&&!record(patch.roleModels))throw new Error("roleModels must be an object")
  const normalizedRolePatch:Partial<Record<ModelRoutedChildRole,string[]|null>>={}
  for(const [role,value] of Object.entries(patch.roleModels??{})){
    if(!isModelRoutedChildRole(role))throw new Error(`Unsupported Hi child role: ${role}`)
    if(value===null){normalizedRolePatch[role]=null;continue}
    if(!Array.isArray(value))throw new Error(`Role models for ${role} must be an array or null`)
    const ids=uniqueModels(value);if(!ids.length)throw new Error(`Role models for ${role} cannot be empty; use null to return the role to automatic`)
    normalizedRolePatch[role]=ids
  }
  const {path,doc}=readProjectSettingsDocument(projectRoot),routing=record(doc.routing)?{...doc.routing}:{},execution=record(doc.execution)?{...doc.execution}:{},existingModels=record(routing.roleModels)?{...routing.roleModels}:{},roleModels={...existingModels}
  if(patch.resetRoleModels)for(const role of MODEL_ROUTED_CHILD_ROLES)delete roleModels[role]
  for(const [role,value] of Object.entries(normalizedRolePatch)){if(value===null)delete roleModels[role];else roleModels[role]=value}
  const priorAdaptiveRoles=Array.isArray(routing.adaptiveRoles)?routing.adaptiveRoles.map(String):[],foreignAdaptiveRoles=priorAdaptiveRoles.filter(role=>!isModelRoutedChildRole(role)),automaticRoles=new Set(priorAdaptiveRoles.filter(isModelRoutedChildRole))
  if(patch.resetRoleModels)for(const role of MODEL_ROUTED_CHILD_ROLES)automaticRoles.add(role)
  for(const [role,value] of Object.entries(normalizedRolePatch)){if(value===null)automaticRoles.add(role as ModelRoutedChildRole);else automaticRoles.delete(role as ModelRoutedChildRole)}
  const currentMode=workModeFromTopology(execution.topology),workMode=patch.workMode??currentMode
  if(patch.workMode!==undefined)execution.topology=topologyFromWorkMode(workMode)
  if(maxAgents!==undefined)execution.maxAgents=maxAgents
  if(parallelism!==undefined)execution.parallelism=parallelism
  if(workMode==="single"){execution.maxAgents=1;execution.parallelism=1}
  if(workMode==="multi"){if(Number(execution.maxAgents??4)<2)execution.maxAgents=2;if(Number(execution.parallelism??2)<1)execution.parallelism=1}
  routing.roleModels=roleModels
  if(normalizedAllowedModels!==undefined){if(normalizedAllowedModels.length)routing.allowedModels=normalizedAllowedModels;else delete routing.allowedModels}
  routing.adaptiveRoles=[...foreignAdaptiveRoles,...automaticRoles]
  routing.modelPolicy=Object.keys(roleModels).some(isModelRoutedChildRole)||Array.isArray(routing.allowedModels)&&routing.allowedModels.length?"manual":"adaptive"
  const next={...doc,schema:1,type:"hi-routing",execution,routing,applied_at:Date.now(),applied_by:"opencode-hi"}
  atomicWrite(path,JSON.stringify(next,null,2)+"\n")
  return{path,workMode,execution:{topology:(execution.topology??"adaptive") as TopologyMode,maxAgents:typeof execution.maxAgents==="number"?execution.maxAgents:undefined,parallelism:typeof execution.parallelism==="number"?execution.parallelism:undefined},roleModels:Object.fromEntries(MODEL_ROUTED_CHILD_ROLES.flatMap(role=>Array.isArray(roleModels[role])?[[role,uniqueModels(roleModels[role])]]:[])),allowedModels:uniqueModels(routing.allowedModels)}
}
