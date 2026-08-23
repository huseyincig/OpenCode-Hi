import { DEFAULT_HI_CONFIG } from './defaults.js'
import { HI_CONFIG_SCHEMA, isModelRoutedChildRole, isRecord, type HiConfig, type CategoryName, type ConfigResolutionReport, type ExecutionPolicyMode, type PrimaryModePolicy } from './schema.js'
import { loadProjectRoutingConfig } from './routing-discovery.js'

function limits(raw:unknown):Record<string,number>{if(!isRecord(raw))return{};const out:Record<string,number>={};for(const [k,v] of Object.entries(raw))if(typeof v==='number'&&Number.isInteger(v)&&v>0)out[k]=Math.min(32,v);return out}
function validNumber(raw:unknown):raw is number{return typeof raw==='number'&&Number.isFinite(raw)}
function bounded(raw:unknown,fallback:number,min:number,max:number):number{return validNumber(raw)?Math.max(min,Math.min(max,Math.floor(raw))):fallback}
function boundedLayer(high:unknown,low:unknown,fallback:number,min:number,max:number):number{return validNumber(high)?bounded(high,fallback,min,max):validNumber(low)?bounded(low,fallback,min,max):fallback}
function modelList(raw:unknown):string[]{if(typeof raw==='string')raw=[raw];return Array.isArray(raw)?[...new Set(raw.filter((x):x is string=>typeof x==='string'&&x.trim().length>0).map(x=>x.trim()))]:[]}
function roleModels(raw:unknown):Record<string,string[]>{if(!isRecord(raw))return{};const out:Record<string,string[]>={};for(const [k,v] of Object.entries(raw)){if(!isModelRoutedChildRole(k))continue;const xs=modelList(v);if(xs.length)out[k]=xs}return out}
function roleVariants(raw:unknown):Record<string,Record<string,string>>{if(!isRecord(raw))return{};const out:Record<string,Record<string,string>>={};for(const [role,v] of Object.entries(raw)){if(!isModelRoutedChildRole(role)||!isRecord(v))continue;const inner:Record<string,string>={};for(const [model,variant] of Object.entries(v))if(typeof variant==='string'&&variant.trim())inner[model]=variant.trim();if(Object.keys(inner).length)out[role]=inner}return out}
function modelMap(raw:unknown):Record<string,string>{if(!isRecord(raw))return{};return Object.fromEntries(Object.entries(raw).filter(([k,v])=>isModelRoutedChildRole(k)&&typeof v==='string'&&v.trim()).map(([k,v])=>[k,String(v).trim()]))}
function threshold(value:unknown):'low'|'medium'|'high'|undefined{return value==='low'||value==='medium'||value==='high'?value:undefined}
function categoryModels(raw:unknown):Partial<Record<CategoryName,string[]>>{if(!isRecord(raw))return{};const out:Partial<Record<CategoryName,string[]>>={};for(const k of ['quick','standard','deep','visual','critical'] as CategoryName[]){const xs=modelList(raw[k]);if(xs.length)out[k]=xs}return out}
function executionPolicy(raw:unknown):ExecutionPolicyMode|undefined{const canonical:Record<string,ExecutionPolicyMode>={minimal:'minimal',balanced:'balanced',thorough:'thorough',adaptive:'adaptive',manual:'manual'};return canonical[typeof raw==='string'?raw:'']}
function primaryMode(raw:unknown):PrimaryModePolicy|undefined{return(['auto','working-manager','manager'] as const).includes(raw as any)?raw as PrimaryModePolicy:undefined}
function routingStrategy(raw:unknown):HiConfig['routing']['strategy']|undefined{return raw==='cost-quality'||raw==='quality'||raw==='cost'?raw:undefined}
function topology(raw:unknown):HiConfig['execution']['topology']|undefined{return raw==='adaptive'||raw==='single-agent'||raw==='multi-agent'?raw:undefined}
function modelMode(raw:unknown):HiConfig['models']['mode']|undefined{return raw==='adaptive'||raw==='fixed'||raw==='role-mapped'?raw:undefined}
function stringValue(raw:unknown):string|undefined{return typeof raw==='string'&&raw.trim()?raw.trim():undefined}
function booleanLayer(high:unknown,low:unknown,fallback:boolean):boolean{return typeof high==='boolean'?high:typeof low==='boolean'?low:fallback}
function legacyRoutingDiagnostics(hostModels:Record<string,unknown>,projectModels:Record<string,unknown>,hostRouting:Record<string,unknown>,projectRouting:Record<string,unknown>):string[]{
  const seen:string[]=[]
  for(const [scope,models,routing] of [['host',hostModels,hostRouting],['project',projectModels,projectRouting]] as const){
    for(const key of ['mode','default','roles'] as const)if(key in models)seen.push(`${scope}:models.${key}`)
    for(const key of ['strategy','categoryModels'] as const)if(key in routing)seen.push(`${scope}:routing.${key}`)
  }
  return seen.map(path=>`legacy model-routing compatibility field ${path} is parsed for diagnostics only and does not control 0.2.4 model choice; use routing.roleModels/roleVariants or the OpenCode agent model`)
}
function profileLayer(low:unknown,high:unknown,fallback:HiConfig['profile']['balanced']):HiConfig['profile']['balanced']{
  const l=isRecord(low)?low:{},h=isRecord(high)?high:{}
  return{specialistThreshold:threshold(h.specialistThreshold)??threshold(l.specialistThreshold)??fallback.specialistThreshold,reviewThreshold:threshold(h.reviewThreshold)??threshold(l.reviewThreshold)??fallback.reviewThreshold}
}

export function resolveHiConfigWithReport(raw:unknown,projectRoot?:string):{config:HiConfig;report:ConfigResolutionReport}{
  const input=isRecord(raw)?raw:{};const notes:string[]=[]
  const suppliedSchema=Number(input.schemaVersion??HI_CONFIG_SCHEMA)
  if(Number.isFinite(suppliedSchema)&&suppliedSchema!==HI_CONFIG_SCHEMA)notes.push(`unsupported config schema ${suppliedSchema}; HI interpreted canonical fields only`)
  const fromProject=projectRoot?loadProjectRoutingConfig(projectRoot):undefined
  if(fromProject&&fromProject.routing)notes.push(`project routing override merged from .opencode/hi/policy/routing.json (${Object.keys(fromProject.routing.roleModels??{}).length} roles)`)
  const hostRouting=isRecord(input.routing)?input.routing:{},projectRouting=isRecord(fromProject?.routing)?fromProject!.routing as unknown as Record<string,unknown>:{}
  const hostParallel=isRecord(input.parallel)?input.parallel:{},projectParallel=isRecord(fromProject?.parallel)?fromProject!.parallel as unknown as Record<string,unknown>:{}
  const compatibility=isRecord(input.compatibility)?input.compatibility:{}
  const hostExecution=isRecord(input.execution)?input.execution:{},projectExecution=isRecord(fromProject?.execution)?fromProject!.execution as unknown as Record<string,unknown>:{}
  const hostModels=isRecord(input.models)?input.models:{},projectModels=isRecord(fromProject?.models)?fromProject!.models as unknown as Record<string,unknown>:{}
  const hostProfile=isRecord(input.profile)?input.profile:{},projectProfile=isRecord(fromProject?.profile)?fromProject!.profile as unknown as Record<string,unknown>:{}
  notes.push(...legacyRoutingDiagnostics(hostModels,projectModels,hostRouting,projectRouting))

  const hostAllowedModels=modelList(hostRouting.allowedModels),projectAllowedModels=modelList(projectRouting.allowedModels)
  const allowedModels=hostAllowedModels.length&&projectAllowedModels.length?projectAllowedModels.filter(x=>hostAllowedModels.includes(x)):projectAllowedModels.length?projectAllowedModels:hostAllowedModels
  const hostAllowed=modelList(hostRouting.allowedProviders),projectAllowed=modelList(projectRouting.allowedProviders)
  const hostDenied=modelList(hostRouting.deniedModels),projectDenied=modelList(projectRouting.deniedModels)
  const allowedProviders=hostAllowed.length&&projectAllowed.length?hostAllowed.filter(x=>projectAllowed.includes(x)):projectAllowed.length?projectAllowed:hostAllowed
  const deniedModels=[...new Set([...hostDenied,...projectDenied])]

  const config:HiConfig={
    schemaVersion:HI_CONFIG_SCHEMA,
    executionPolicy:executionPolicy((fromProject as any)?.executionPolicy)??executionPolicy(input.executionPolicy)??DEFAULT_HI_CONFIG.executionPolicy,
    primaryMode:(topology(projectExecution.topology)??topology(hostExecution.topology)??DEFAULT_HI_CONFIG.execution.topology)==='single-agent'?'working-manager':primaryMode(fromProject?.primaryMode)??primaryMode(input.primaryMode)??DEFAULT_HI_CONFIG.primaryMode,
    compatibility:{mode:compatibility.mode==='strict'?'strict':DEFAULT_HI_CONFIG.compatibility.mode,validatedOpenCodeVersions:modelList(compatibility.validatedOpenCodeVersions)},
    execution:{
      topology:topology(projectExecution.topology)??topology(hostExecution.topology)??DEFAULT_HI_CONFIG.execution.topology,
      maxAgents:boundedLayer(projectExecution.maxAgents,hostExecution.maxAgents,DEFAULT_HI_CONFIG.execution.maxAgents,1,8),
      parallelism:boundedLayer(projectExecution.parallelism,hostExecution.parallelism,DEFAULT_HI_CONFIG.execution.parallelism,1,8),
    },
    models:{
      mode:modelMode(projectModels.mode)??modelMode(hostModels.mode)??DEFAULT_HI_CONFIG.models.mode,
      default:stringValue(projectModels.default)??stringValue(hostModels.default)??DEFAULT_HI_CONFIG.models.default,
      roles:{...modelMap(hostModels.roles),...modelMap(projectModels.roles)},
    },
    routing:{
      strategy:routingStrategy(projectRouting.strategy)??routingStrategy(hostRouting.strategy)??DEFAULT_HI_CONFIG.routing.strategy,
      categoryModels:{...categoryModels(hostRouting.categoryModels),...categoryModels(projectRouting.categoryModels)},
      categoryVariants:{...categoryModels(hostRouting.categoryVariants),...categoryModels(projectRouting.categoryVariants)},
      roleModels:{...roleModels(hostRouting.roleModels),...roleModels(projectRouting.roleModels)},
      roleVariants:{...roleVariants(hostRouting.roleVariants),...roleVariants(projectRouting.roleVariants)},
      maxFallbacks:boundedLayer(projectRouting.maxFallbacks,hostRouting.maxFallbacks,DEFAULT_HI_CONFIG.routing.maxFallbacks,0,6),
      allowedModels,allowedProviders,deniedModels,
    },
    parallel:{
      enabled:booleanLayer(projectParallel.enabled,hostParallel.enabled,DEFAULT_HI_CONFIG.parallel.enabled),
      max:boundedLayer(projectParallel.max,hostParallel.max,DEFAULT_HI_CONFIG.parallel.max,1,8),
      providers:{...limits(hostParallel.providers),...limits(projectParallel.providers)},
      models:{...limits(hostParallel.models),...limits(projectParallel.models)},
    },
    profile:{
      minimal:profileLayer(hostProfile.minimal,projectProfile.minimal,DEFAULT_HI_CONFIG.profile.minimal),
      balanced:profileLayer(hostProfile.balanced,projectProfile.balanced,DEFAULT_HI_CONFIG.profile.balanced),
      thorough:profileLayer(hostProfile.thorough,projectProfile.thorough,DEFAULT_HI_CONFIG.profile.thorough),
    },
  }
  return{config,report:{schema:HI_CONFIG_SCHEMA,canonical:suppliedSchema===HI_CONFIG_SCHEMA,notes}}
}
export function resolveHiConfig(raw:unknown,projectRoot?:string):HiConfig{return resolveHiConfigWithReport(raw,projectRoot).config}
