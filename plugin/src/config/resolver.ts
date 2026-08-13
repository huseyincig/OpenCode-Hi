import { DEFAULT_HI_CONFIG } from './defaults.js'
import { HI_CONFIG_SCHEMA, isRecord, type HiConfig, type CategoryName, type ConfigResolutionReport, type ExecutionPolicyMode, type PrimaryModePolicy } from './schema.js'
import { loadProjectRoutingConfig } from './routing-discovery.js'

function limits(raw:unknown):Record<string,number>{if(!isRecord(raw))return{};const out:Record<string,number>={};for(const [k,v] of Object.entries(raw))if(typeof v==='number'&&Number.isInteger(v)&&v>0)out[k]=Math.min(32,v);return out}
function bounded(raw:unknown,fallback:number,min:number,max:number):number{return typeof raw==='number'&&Number.isFinite(raw)?Math.max(min,Math.min(max,Math.floor(raw))):fallback}
function modelList(raw:unknown):string[]{if(typeof raw==='string')raw=[raw];return Array.isArray(raw)?[...new Set(raw.filter((x):x is string=>typeof x==='string'&&x.trim().length>0).map(x=>x.trim()))].slice(0,8):[]}
function roleModels(raw:unknown):Record<string,string[]>{if(!isRecord(raw))return{};const out:Record<string,string[]>={};for(const [k,v] of Object.entries(raw)){const xs=modelList(v);if(xs.length)out[k]=xs}return out}
function roleVariants(raw:unknown):Record<string,Record<string,string>>{if(!isRecord(raw))return{};const out:Record<string,Record<string,string>>={};for(const [role,v] of Object.entries(raw)){if(!isRecord(v))continue;const inner:Record<string,string>={};for(const [model,variant] of Object.entries(v))if(typeof variant==='string'&&variant.trim())inner[model]=variant.trim();if(Object.keys(inner).length)out[role]=inner}return out}
function profileSettings(raw:unknown,fallback:any):any{if(!isRecord(raw))return fallback;const out:any={...fallback};for(const [k,v] of Object.entries(raw))out[k]=v;return out}
function categoryModels(raw:unknown):Partial<Record<CategoryName,string[]>>{if(!isRecord(raw))return{};const out:Partial<Record<CategoryName,string[]>>={};for(const k of ['quick','standard','deep','visual','critical'] as CategoryName[]){const xs=modelList(raw[k]);if(xs.length)out[k]=xs}return out}

function executionPolicy(raw:unknown):ExecutionPolicyMode|undefined{
  const canonical:Record<string,ExecutionPolicyMode>={minimal:'minimal',balanced:'balanced',thorough:'thorough',adaptive:'adaptive',manual:'manual'}
  const key=typeof raw==='string'?raw:''
  return canonical[key]
}
function profileBlock(raw:unknown):HiConfig['profile']|undefined{
  if(!isRecord(raw))return undefined
  const minimal=(raw as any).minimal
  const balanced=(raw as any).balanced
  const thorough=(raw as any).thorough
  return{minimal:profileSettings(minimal,DEFAULT_HI_CONFIG.profile.minimal),balanced:profileSettings(balanced,DEFAULT_HI_CONFIG.profile.balanced),thorough:profileSettings(thorough,DEFAULT_HI_CONFIG.profile.thorough)}
}

export function resolveHiConfigWithReport(raw:unknown,projectRoot?:string):{config:HiConfig;report:ConfigResolutionReport}{
  const input=isRecord(raw)?raw:{};const notes:string[]=[]
  const suppliedSchema=Number(input.schemaVersion??HI_CONFIG_SCHEMA)
  if(Number.isFinite(suppliedSchema)&&suppliedSchema!==HI_CONFIG_SCHEMA)notes.push(`unsupported config schema ${suppliedSchema}; HI interpreted canonical fields only`)
  const fromProject=projectRoot?loadProjectRoutingConfig(projectRoot):undefined
  if(fromProject&&fromProject.routing)notes.push(`project routing override merged from .opencode/hi/policy/routing.json (${Object.keys(fromProject.routing.roleModels??{}).length} roles)`)
  const routing=isRecord(input.routing)?input.routing:{};const projectRouting:Record<string,unknown>=isRecord(fromProject?.routing)?fromProject!.routing as unknown as Record<string,unknown>:{};const parallel=isRecord(fromProject?.parallel)?fromProject!.parallel:(isRecord(input.parallel)?input.parallel:{});const teamMode=isRecord(fromProject?.teamMode)?fromProject!.teamMode:(isRecord(input.teamMode)?input.teamMode:{});const compatibility=isRecord(input.compatibility)?input.compatibility:{}
  const execution=isRecord(fromProject?.execution)?fromProject!.execution:(isRecord(input.execution)?input.execution:{});const modelsCfg=isRecord(fromProject?.models)?fromProject!.models:(isRecord(input.models)?input.models:{});
  const projectRM=fromProject?.routing?.roleModels??{}
  const projectRV=fromProject?.routing?.roleVariants??{}
  const projectCM=fromProject?.routing?.categoryModels??{}
  const projectCV=fromProject?.routing?.categoryVariants??{}
  const rawAllowed=modelList(routing.allowedProviders)
  const rawDenied=modelList(routing.deniedModels)
  const projectAllowed=modelList(fromProject?.routing?.allowedProviders)
  const projectDenied=modelList(fromProject?.routing?.deniedModels)
  const allowedProviders=rawAllowed.length&&projectAllowed.length?rawAllowed.filter(x=>projectAllowed.includes(x)):projectAllowed.length?projectAllowed:rawAllowed
  const deniedModels=[...new Set([...rawDenied,...projectDenied])]
  const rawStrategy=routing.strategy
  const projectStrategy=fromProject?.routing?.strategy
  const strategy: 'cost-quality'|'quality'|'cost'=(projectStrategy==='quality'||projectStrategy==='cost')?projectStrategy:(rawStrategy==='quality'||rawStrategy==='cost')?rawStrategy:'cost-quality'
  const config:HiConfig={
    schemaVersion:HI_CONFIG_SCHEMA,
    executionPolicy:executionPolicy((fromProject as any)?.executionPolicy)??executionPolicy(input.executionPolicy)??'adaptive',
    primaryMode:(['auto','working-manager','manager'] as PrimaryModePolicy[]).includes(fromProject?.primaryMode as PrimaryModePolicy)?fromProject!.primaryMode as PrimaryModePolicy:((['auto','working-manager','manager'] as PrimaryModePolicy[]).includes(input.primaryMode as PrimaryModePolicy)?input.primaryMode as PrimaryModePolicy:'auto'),
    compatibility:{mode:compatibility.mode==='strict'?'strict':'compatible',validatedOpenCodeVersions:modelList(compatibility.validatedOpenCodeVersions)},
    execution:{topology:['single-agent','multi-agent'].includes(String(execution.topology))?execution.topology as 'single-agent'|'multi-agent':'adaptive',maxAgents:bounded(execution.maxAgents,DEFAULT_HI_CONFIG.execution.maxAgents,1,8),parallelism:bounded(execution.parallelism,DEFAULT_HI_CONFIG.execution.parallelism,1,8)},
    models:{mode:['fixed','role-mapped'].includes(String(modelsCfg.mode))?modelsCfg.mode as 'fixed'|'role-mapped':'adaptive',default:typeof modelsCfg.default==='string'&&modelsCfg.default.trim()?modelsCfg.default.trim():'auto',roles:isRecord(modelsCfg.roles)?Object.fromEntries(Object.entries(modelsCfg.roles).filter(([,v])=>typeof v==='string'&&v.trim()).map(([k,v])=>[k,String(v).trim()])):{}},
    routing:{strategy,categoryModels:{...categoryModels(routing.categoryModels),...categoryModels(projectCM)},categoryVariants:{...categoryModels(routing.categoryVariants),...categoryModels(projectCV)},roleModels:{...roleModels(routing.roleModels),...roleModels(projectRM)},roleVariants:{...roleVariants(routing.roleVariants),...roleVariants(projectRV)},maxFallbacks:bounded(projectRouting.maxFallbacks??routing.maxFallbacks,DEFAULT_HI_CONFIG.routing.maxFallbacks,0,6),allowedProviders,deniedModels},
    parallel:{enabled:parallel.enabled!==false,max:bounded(parallel.max,DEFAULT_HI_CONFIG.parallel.max,1,8),providers:limits(parallel.providers),models:limits(parallel.models)},
    teamMode:{enabled:teamMode.enabled===true,maxMembers:bounded(teamMode.maxMembers,4,2,8),maxWallMinutes:bounded(teamMode.maxWallMinutes,45,1,240)},
    profile:profileBlock(fromProject?.profile)??profileBlock(input.profile)??DEFAULT_HI_CONFIG.profile,
  }
  return{config,report:{schema:HI_CONFIG_SCHEMA,canonical:suppliedSchema===HI_CONFIG_SCHEMA,notes}}
}
export function resolveHiConfig(raw:unknown,projectRoot?:string):HiConfig{return resolveHiConfigWithReport(raw,projectRoot).config}
