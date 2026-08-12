import { DEFAULT_HHC_CONFIG } from './defaults.js'
import { HHC_CONFIG_SCHEMA, isRecord, type HhcConfig, type CategoryName, type ConfigResolutionReport, type AutonomyMode, type PrimaryModePolicy } from './schema.js'
import { loadProjectRoutingConfig } from './routing-discovery.js'

function limits(raw:unknown):Record<string,number>{if(!isRecord(raw))return{};const out:Record<string,number>={};for(const [k,v] of Object.entries(raw))if(typeof v==='number'&&Number.isInteger(v)&&v>0)out[k]=Math.min(32,v);return out}
function bounded(raw:unknown,fallback:number,min:number,max:number):number{return typeof raw==='number'&&Number.isFinite(raw)?Math.max(min,Math.min(max,Math.floor(raw))):fallback}
function modelList(raw:unknown):string[]{if(typeof raw==='string')raw=[raw];return Array.isArray(raw)?[...new Set(raw.filter((x):x is string=>typeof x==='string'&&x.trim().length>0).map(x=>x.trim()))].slice(0,8):[]}
function roleModels(raw:unknown):Record<string,string[]>{if(!isRecord(raw))return{};const out:Record<string,string[]>={};for(const [k,v] of Object.entries(raw)){const xs=modelList(v);if(xs.length)out[k]=xs}return out}
function roleVariants(raw:unknown):Record<string,Record<string,string>>{if(!isRecord(raw))return{};const out:Record<string,Record<string,string>>={};for(const [role,v] of Object.entries(raw)){if(!isRecord(v))continue;const inner:Record<string,string>={};for(const [model,variant] of Object.entries(v))if(typeof variant==='string'&&variant.trim())inner[model]=variant.trim();if(Object.keys(inner).length)out[role]=inner}return out}
function profileSettings(raw:unknown,fallback:any):any{if(!isRecord(raw))return fallback;const out:any={...fallback};for(const [k,v] of Object.entries(raw))out[k]=v;return out}
function categoryModels(raw:unknown):Partial<Record<CategoryName,string[]>>{if(!isRecord(raw))return{};const out:Partial<Record<CategoryName,string[]>>={};for(const k of ['quick','standard','deep','visual','critical'] as CategoryName[]){const xs=modelList(raw[k]);if(xs.length)out[k]=xs}return out}

export function resolveHhcConfigWithReport(raw:unknown,projectRoot?:string):{config:HhcConfig;report:ConfigResolutionReport}{
  const input=isRecord(raw)?raw:{};const notes:string[]=[]
  const suppliedSchema=Number(input.schemaVersion??HHC_CONFIG_SCHEMA)
  if(Number.isFinite(suppliedSchema)&&suppliedSchema!==HHC_CONFIG_SCHEMA)notes.push(`unsupported config schema ${suppliedSchema}; OHO interpreted canonical fields only`)
  const fromProject=projectRoot?loadProjectRoutingConfig(projectRoot):undefined
  if(fromProject&&fromProject.routing)notes.push(`project routing override merged from .opencode/oho-routing.json (${Object.keys(fromProject.routing.roleModels??{}).length} roles)`)
  const routing=isRecord(input.routing)?input.routing:{};const projectRouting:Record<string,unknown>=isRecord(fromProject?.routing)?fromProject!.routing as unknown as Record<string,unknown>:{};const parallel=isRecord(fromProject?.parallel)?fromProject!.parallel:(isRecord(input.parallel)?input.parallel:{});const teamMode=isRecord(fromProject?.teamMode)?fromProject!.teamMode:(isRecord(input.teamMode)?input.teamMode:{});const compatibility=isRecord(input.compatibility)?input.compatibility:{}
  const projectRM=fromProject?.routing?.roleModels??{}
  const projectRV=fromProject?.routing?.roleVariants??{}
  const projectCM=fromProject?.routing?.categoryModels??{}
  const projectCV=fromProject?.routing?.categoryVariants??{}
  const projectAllowed=fromProject?.routing?.allowedProviders
  const projectDenied=fromProject?.routing?.deniedModels
  const rawStrategy=routing.strategy
  const projectStrategy=fromProject?.routing?.strategy
  const strategy: 'cost-quality'|'quality'|'cost'=(rawStrategy==='quality'||rawStrategy==='cost')?rawStrategy:(projectStrategy==='quality'||projectStrategy==='cost')?projectStrategy:'cost-quality'
  const config:HhcConfig={
    schemaVersion:HHC_CONFIG_SCHEMA,
    autonomy:(['basic','standard','powerful','smart','manual'] as AutonomyMode[]).includes(fromProject?.autonomy as AutonomyMode)?fromProject!.autonomy as AutonomyMode:((['basic','standard','powerful','smart','manual'] as AutonomyMode[]).includes(input.autonomy as AutonomyMode)?input.autonomy as AutonomyMode:'smart'),
    primaryMode:(['auto','working-manager','manager'] as PrimaryModePolicy[]).includes(fromProject?.primaryMode as PrimaryModePolicy)?fromProject!.primaryMode as PrimaryModePolicy:((['auto','working-manager','manager'] as PrimaryModePolicy[]).includes(input.primaryMode as PrimaryModePolicy)?input.primaryMode as PrimaryModePolicy:'auto'),
    compatibility:{mode:compatibility.mode==='strict'?'strict':'compatible',validatedOpenCodeVersions:modelList(compatibility.validatedOpenCodeVersions)},
    routing:{strategy,categoryModels:{...categoryModels(routing.categoryModels),...categoryModels(projectCM)},categoryVariants:{...categoryModels(routing.categoryVariants),...categoryModels(projectCV)},roleModels:{...roleModels(routing.roleModels),...roleModels(projectRM)},roleVariants:{...roleVariants(routing.roleVariants),...roleVariants(projectRV)},modelPolicy:(fromProject?.routing?.modelPolicy??routing.modelPolicy)==='manual'?'manual':(fromProject?.routing?.modelPolicy??routing.modelPolicy)==='recommended'?'recommended':'smart-select',smartSelectRoles:modelList(fromProject?.routing?.smartSelectRoles??routing.smartSelectRoles),maxFallbacks:bounded(projectRouting.maxFallbacks??routing.maxFallbacks,DEFAULT_HHC_CONFIG.routing.maxFallbacks,0,6),allowedProviders:projectAllowed&&projectAllowed.length?projectAllowed:modelList(routing.allowedProviders),deniedModels:projectDenied&&projectDenied.length?projectDenied:modelList(routing.deniedModels)},
    parallel:{enabled:parallel.enabled!==false,max:bounded(parallel.max,DEFAULT_HHC_CONFIG.parallel.max,1,8),providers:limits(parallel.providers),models:limits(parallel.models)},
    teamMode:{enabled:teamMode.enabled===true,auto:teamMode.auto===true,maxMembers:bounded(teamMode.maxMembers,4,2,8),maxMessages:bounded(teamMode.maxMessages,24,1,100),maxTurns:bounded(teamMode.maxTurns,12,1,50),maxWallMinutes:bounded(teamMode.maxWallMinutes,45,1,240)},
    profile:isRecord(fromProject?.profile)?{basic:profileSettings((fromProject!.profile as any).basic,DEFAULT_HHC_CONFIG.profile.basic),standard:profileSettings((fromProject!.profile as any).standard,DEFAULT_HHC_CONFIG.profile.standard),powerful:profileSettings((fromProject!.profile as any).powerful,DEFAULT_HHC_CONFIG.profile.powerful)}:(isRecord(input.profile)?{basic:profileSettings((input.profile as any).basic,DEFAULT_HHC_CONFIG.profile.basic),standard:profileSettings((input.profile as any).standard,DEFAULT_HHC_CONFIG.profile.standard),powerful:profileSettings((input.profile as any).powerful,DEFAULT_HHC_CONFIG.profile.powerful)}:DEFAULT_HHC_CONFIG.profile),
  }
  return{config,report:{schema:HHC_CONFIG_SCHEMA,canonical:suppliedSchema===HHC_CONFIG_SCHEMA,notes}}
}
export function resolveHhcConfig(raw:unknown,projectRoot?:string):HhcConfig{return resolveHhcConfigWithReport(raw,projectRoot).config}
