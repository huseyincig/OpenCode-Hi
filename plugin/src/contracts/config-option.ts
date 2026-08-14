import {assertCanonicalId,assertNonEmptyString,assertRecord,assertStrictKeys,ContractValidationError} from './common.js'

export type ConfigOptionClassification='runtime'|'diagnostic'|'schema-marker'
export type ConfigSafetySemantics='preference'|'constraint'|'authority-boundary'|'capacity'
export interface ConfigOptionContract{
  id:string
  path:string
  classification:ConfigOptionClassification
  type:string
  defaultValue:unknown
  owner:string
  sourceSurfaces:string[]
  precedenceOrder:string[]
  validator:string
  safetySemantics:ConfigSafetySemantics
  runtimeConsumer?:string
  executorEffect?:string
  diagnosticConsumer?:string
  diagnosticEffect?:string
  behavioralAcceptanceRefs:string[]
  doctorProjection?:string
}
const CLASSES=new Set<ConfigOptionClassification>(['runtime','diagnostic','schema-marker'])
const SAFETY=new Set<ConfigSafetySemantics>(['preference','constraint','authority-boundary','capacity'])
function strings(value:unknown,field:string):string[]{if(!Array.isArray(value)||!value.length)throw new ContractValidationError(field,'must be a non-empty array');const out=value.map((x,i)=>assertNonEmptyString(x,`${field}[${i}]`));if(new Set(out).size!==out.length)throw new ContractValidationError(field,'duplicate entry');return out}
export function validateConfigOption(value:unknown,field='configOption'):ConfigOptionContract{
  const r=assertRecord(value,field)
  const allowed=['id','path','classification','type','defaultValue','owner','sourceSurfaces','precedenceOrder','validator','safetySemantics','runtimeConsumer','executorEffect','diagnosticConsumer','diagnosticEffect','behavioralAcceptanceRefs','doctorProjection']
  const required=['id','path','classification','type','defaultValue','owner','sourceSurfaces','precedenceOrder','validator','safetySemantics','behavioralAcceptanceRefs']
  assertStrictKeys(r,allowed,required,field)
  const id=assertCanonicalId(r.id,`${field}.id`),path=assertNonEmptyString(r.path,`${field}.path`),classification=assertNonEmptyString(r.classification,`${field}.classification`) as ConfigOptionClassification
  if(!CLASSES.has(classification))throw new ContractValidationError(`${field}.classification`,'unsupported config option classification')
  const safetySemantics=assertNonEmptyString(r.safetySemantics,`${field}.safetySemantics`) as ConfigSafetySemantics
  if(!SAFETY.has(safetySemantics))throw new ContractValidationError(`${field}.safetySemantics`,'unsupported safety semantics')
  const runtimeConsumer=r.runtimeConsumer===undefined?undefined:assertNonEmptyString(r.runtimeConsumer,`${field}.runtimeConsumer`)
  const executorEffect=r.executorEffect===undefined?undefined:assertNonEmptyString(r.executorEffect,`${field}.executorEffect`)
  const diagnosticConsumer=r.diagnosticConsumer===undefined?undefined:assertNonEmptyString(r.diagnosticConsumer,`${field}.diagnosticConsumer`)
  const diagnosticEffect=r.diagnosticEffect===undefined?undefined:assertNonEmptyString(r.diagnosticEffect,`${field}.diagnosticEffect`)
  if(classification==='runtime'){
    if(!runtimeConsumer||!executorEffect)throw new ContractValidationError(field,'runtime option requires runtimeConsumer and executorEffect')
    if(diagnosticConsumer||diagnosticEffect)throw new ContractValidationError(field,'runtime option cannot masquerade as diagnostic-only')
  }else{
    if(runtimeConsumer||executorEffect)throw new ContractValidationError(field,'non-runtime option cannot claim runtime executor effect')
    if(!diagnosticConsumer||!diagnosticEffect)throw new ContractValidationError(field,'diagnostic/schema option requires diagnosticConsumer and diagnosticEffect')
  }
  return{id,path,classification,type:assertNonEmptyString(r.type,`${field}.type`),defaultValue:r.defaultValue,owner:assertCanonicalId(r.owner,`${field}.owner`),sourceSurfaces:strings(r.sourceSurfaces,`${field}.sourceSurfaces`),precedenceOrder:strings(r.precedenceOrder,`${field}.precedenceOrder`),validator:assertNonEmptyString(r.validator,`${field}.validator`),safetySemantics,...(runtimeConsumer===undefined?{}:{runtimeConsumer}),...(executorEffect===undefined?{}:{executorEffect}),...(diagnosticConsumer===undefined?{}:{diagnosticConsumer}),...(diagnosticEffect===undefined?{}:{diagnosticEffect}),behavioralAcceptanceRefs:strings(r.behavioralAcceptanceRefs,`${field}.behavioralAcceptanceRefs`),...(r.doctorProjection===undefined?{}:{doctorProjection:assertNonEmptyString(r.doctorProjection,`${field}.doctorProjection`)})}
}
export function validateConfigOptionCatalog(values:unknown[]):ConfigOptionContract[]{
  const out=values.map((x,i)=>validateConfigOption(x,`configOptions[${i}]`)),ids=new Set<string>(),paths=new Set<string>()
  for(const item of out){if(ids.has(item.id))throw new ContractValidationError('configOptions',`duplicate id ${item.id}`);if(paths.has(item.path))throw new ContractValidationError('configOptions',`duplicate path ${item.path}`);ids.add(item.id);paths.add(item.path)}
  return out
}
