import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runtimeStatePath } from '../runtime/storage/locations.js'
import { RUNTIME_STATE_SCHEMA } from '../runtime/state/persistence.js'

export interface ProjectInspection {
  configPath?: string
  pluginRegistered?: boolean
  configuredHiPluginSpecs: string[]
  localHiPlugin: boolean
  hiLocalPluginPaths: string[]
  permissionConfigured: boolean
  skillPermissionConfigured: boolean
  ownershipState: 'missing'|'healthy'|'invalid'
  ownershipSchema?: number
  ownershipSchemaValid?: boolean
  runtimeState: 'missing'|'healthy'|'invalid'
  runtimeSchema?: number
  runtimeSchemaValid?: boolean
  interruptedTransaction: boolean
  configDrift?: boolean
  openCodeVersion?: string
  agentDefinitions: string[]
  discoveredSkills: string[]
  warnings: string[]
  routingConfigPath?: string
  routingConfigSchema?: number
  routingConfigStrategy?: 'cost-quality'|'quality'|'cost'
  routingConfigRoleModels?: Record<string,string[]>
  routingConfigSchemaValid?: boolean
}

function stripJsonc(text:string):string{
  let out='';let i=0;let quoted=false;let esc=false
  while(i<text.length){const c=text[i]
    if(quoted){out+=c;if(esc)esc=false;else if(c==='\\')esc=true;else if(c==='"')quoted=false;i++;continue}
    if(c==='"'){quoted=true;out+=c;i++;continue}
    if(c==='/'&&text[i+1]==='/'){i+=2;while(i<text.length&&!['\n','\r'].includes(text[i]))i++;continue}
    if(c==='/'&&text[i+1]==='*'){i+=2;while(i+1<text.length&&text.slice(i,i+2)!=='*/')i++;i+=2;continue}
    out+=c;i++
  }
  return out
}
function readJson(path:string):any{try{const text=readFileSync(path,'utf8');return JSON.parse(path.endsWith('.jsonc')?stripJsonc(text):text)}catch{return undefined}}

function childDirsWith(root:string,file:string):string[]{try{return readdirSync(root).filter((name:string)=>existsSync(join(root,name,file))).sort()}catch{return[]}}

function sha256(path:string):string|undefined{try{return createHash('sha256').update(readFileSync(path)).digest('hex')}catch{return undefined}}

function localPluginFiles(root:string):string[]{try{return readdirSync(root).filter((name:string)=>/\.(?:js|mjs|cjs|ts)$/i.test(name)).map((name:string)=>join(root,name)).sort()}catch{return[]}}
function pluginKind(path:string):'hi'|'other'{const name=path.toLowerCase();if(/hi[-_. ]?next|hi[-_. ]?ai|hi/.test(name))return'hi';return'other'}
function hiPluginSpec(x:unknown):x is string{return typeof x==='string'&&(x==='opencode-hi'||x.startsWith('opencode-hi@')||/OpenCode-Hi/i.test(x))}

export function inspectProject(directory:string):ProjectInspection{
  const warnings:string[]=[]
  const json=join(directory,'opencode.json');const jsonc=join(directory,'opencode.jsonc');const configPath=existsSync(json)?json:existsSync(jsonc)?jsonc:undefined
  const config=configPath?readJson(configPath):undefined
  const plugins=Array.isArray(config?.plugin)?config.plugin:[]
  const ownershipPath=join(directory,'.opencode','hi','provenance','setup.json');const ownershipExists=existsSync(ownershipPath);const ownership=ownershipExists?readJson(ownershipPath):undefined;const ownershipSchema=typeof ownership?.schema==='number'?Number(ownership.schema):undefined;const ownershipSchemaValid=!ownershipExists||(ownership!==undefined&&Number(ownership.schema)===2)
  const runtimePath=runtimeStatePath(directory);const runtimeExists=existsSync(runtimePath);const runtime=runtimeExists?readJson(runtimePath):undefined;const runtimeSchema=typeof runtime?.schema==='number'?Number(runtime.schema):undefined;const runtimeSchemaValid=!runtimeExists||(runtime!==undefined&&Number(runtime.schema)===RUNTIME_STATE_SCHEMA)
  const routingPath=join(directory,'.opencode','hi','policy','routing.json');const routing=existsSync(routingPath)?readJson(routingPath):undefined
  const routingSchema=typeof routing?.schema==='number'?routing.schema:undefined
  const routingStrategy=routingSchema===1&&(routing.routing?.strategy==='cost-quality'||routing.routing?.strategy==='quality'||routing.routing?.strategy==='cost')?routing.routing.strategy:undefined
  const routingRoleModels=routingSchema===1&&routing.routing?.roleModels&&typeof routing.routing.roleModels==='object'?Object.fromEntries(Object.entries(routing.routing.roleModels).filter((entry):entry is [string,unknown]=>Array.isArray(entry[1])).map(([k,v])=>[k,(v as unknown[]).filter((x):x is string=>typeof x==='string')])):undefined
  const routingSchemaValid=routing===undefined?true:routingSchema===1
  const journal=join(tmpdir(),'opencode-hi',createHash('sha256').update(directory).digest('hex').slice(0,16),'lifecycle-transaction.json')
  const home=process.env.HOME??process.env.USERPROFILE??'';const globalOpenCode=process.env.OPENCODE_CONFIG_DIR||join(home,'.config','opencode')
  const localPluginPaths=[...localPluginFiles(join(globalOpenCode,'plugins')),...localPluginFiles(join(directory,'.opencode','plugins'))]
  const hiLocalPluginPaths=localPluginPaths.filter(x=>pluginKind(x)==='hi')
  const agentDefinitions=[...new Set([...(config?.agent&&typeof config.agent==='object'?Object.keys(config.agent):[]),...childDirsWith(join(directory,'.opencode','agents'),'.__never__')])].sort()
  // Agent files are markdown, not directories. Keep config names and add local *.md stems.
  try{for(const name of readdirSync(join(directory,'.opencode','agents')))if(name.endsWith('.md'))agentDefinitions.push(name.slice(0,-3))}catch{}
  const discoveredSkills=[...new Set([...childDirsWith(join(directory,'.opencode','skills'),'SKILL.md'),...childDirsWith(join(globalOpenCode,'skills'),'SKILL.md')])].sort()
  let configDrift: boolean|undefined
  const item=ownership?.managed?.config
  if(configPath&&item?.after_sha256){const actual=sha256(configPath);if(actual)configDrift=actual!==item.after_sha256}
  if(configPath&&!config)warnings.push('OpenCode config exists but could not be parsed')
  if(ownership&&typeof ownership.schema!=='number')warnings.push('Ownership state has no numeric schema')
  if(ownership&&ownershipSchemaValid===false)warnings.push(`Ownership schema ${String(ownership.schema)} is not supported by this runtime`)
  if(runtimeExists&&!runtime)warnings.push('Runtime-state exists but could not be parsed')
  if(runtime&&Number(runtime.schema)!==RUNTIME_STATE_SCHEMA)warnings.push(`Runtime-state schema ${String(runtime.schema)} is not supported by this runtime`)
  return {
    configPath,
    pluginRegistered:config?plugins.some(hiPluginSpec):undefined,
    configuredHiPluginSpecs:plugins.filter(hiPluginSpec),
    localHiPlugin:hiLocalPluginPaths.length>0,
    hiLocalPluginPaths,
    permissionConfigured:Boolean(config?.permission),
    skillPermissionConfigured:Boolean(config?.permission?.skill??(config?.agent&&Object.values(config.agent).some((a:any)=>Boolean(a?.permission?.skill)))),
    ownershipState:!ownershipExists?'missing':ownership&&ownershipSchemaValid?'healthy':'invalid',
    ownershipSchema,
    ownershipSchemaValid,
    runtimeState:!runtimeExists?'missing':runtime&&runtimeSchemaValid?'healthy':'invalid',
    runtimeSchema,
    runtimeSchemaValid,
    interruptedTransaction:existsSync(journal),
    configDrift,
    openCodeVersion:process.env.OPENCODE_VERSION??process.env.OPENCODE_CLI_VERSION,
    agentDefinitions:[...new Set(agentDefinitions)].sort(),
    discoveredSkills,
    warnings,
    routingConfigPath:existsSync(routingPath)?routingPath:undefined,
    routingConfigSchema:routingSchema,
    routingConfigStrategy:routingStrategy,
    routingConfigRoleModels:routingRoleModels,
    routingConfigSchemaValid:routingSchemaValid,
  }
}
