import { ContractValidationError, assertNonEmptyString, assertRecord } from './common.js'

export interface ModelQuirkHints { compactInstructionSensitive?:boolean; avoidLongNestedPlans?:boolean; explicitToolBoundaries?:boolean }

export interface ModelCapabilityProfile {
  id:string
  provider?:string
  cost?:number
  quality?:number
  writeCapable?:boolean
  tags?:string[]
  expectedTurns?:number
  contextOverhead?:number
  variants?:string[]
  quirks?:ModelQuirkHints
  source?:'runtime-inventory'|'configured'|'synthetic-host-default'
}

export interface NormalizedModelCapabilityProfile extends ModelCapabilityProfile {
  cost:number
  quality:number
  writeCapable:boolean
  tags:string[]
  variants:string[]
  quirks?:ModelQuirkHints
  source:'runtime-inventory'|'configured'|'synthetic-host-default'
}

export interface ModelIdentityRef { model?:string; variant?:string; source?:string }
export type ModelIdentityStatus='host-default-or-unconstrained'|'projection-mismatch'|'model-unverified'|'model-mismatch'|'variant-unverified'|'variant-mismatch'|'verified'
export interface ModelExecutionIdentity {
  requested?:ModelIdentityRef
  selected?:ModelIdentityRef
  projected?:ModelIdentityRef
  observed?:ModelIdentityRef
  effective?:ModelIdentityRef
  modelVerified:boolean
  variantVerified?:boolean
  status:ModelIdentityStatus
}

function finiteNonNegative(value:unknown,fallback:number,field:string):number{
  if(value===undefined||value===null)return fallback
  if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new ContractValidationError(field,'must be a finite non-negative number')
  return value
}
function positiveOptional(value:unknown,field:string):number|undefined{
  if(value===undefined)return undefined
  if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw new ContractValidationError(field,'must be a positive finite number')
  return value
}
function stringList(value:unknown,field:string):string[]{
  if(value===undefined)return[]
  if(!Array.isArray(value)||!value.every(x=>typeof x==='string'&&x.trim()))throw new ContractValidationError(field,'must be an array of non-empty strings')
  return [...new Set(value.map(x=>x.trim()))]
}

export function normalizeModelCapabilityProfile(value:unknown,source:NormalizedModelCapabilityProfile['source']='runtime-inventory',field='model'):NormalizedModelCapabilityProfile{
  const r=assertRecord(value,field)
  const id=assertNonEmptyString(r.id,`${field}.id`).trim()
  const provider=r.provider===undefined?undefined:assertNonEmptyString(r.provider,`${field}.provider`).trim()
  const writeCapable=r.writeCapable===undefined?true:r.writeCapable
  if(typeof writeCapable!=='boolean')throw new ContractValidationError(`${field}.writeCapable`,'must be boolean')
  const expectedTurns=positiveOptional(r.expectedTurns,`${field}.expectedTurns`)
  const contextOverhead=positiveOptional(r.contextOverhead,`${field}.contextOverhead`)
  let quirks:ModelQuirkHints|undefined
  if(r.quirks!==undefined){const q=assertRecord(r.quirks,`${field}.quirks`);quirks={};for(const key of ['compactInstructionSensitive','avoidLongNestedPlans','explicitToolBoundaries'] as const){const value=q[key];if(value!==undefined&&typeof value!=='boolean')throw new ContractValidationError(`${field}.quirks.${key}`,'must be boolean');if(typeof value==='boolean')quirks[key]=value}}
  return{
    id,
    ...(provider?{provider}:{}),
    cost:finiteNonNegative(r.cost,0,`${field}.cost`),
    quality:finiteNonNegative(r.quality,0,`${field}.quality`),
    writeCapable,
    tags:stringList(r.tags,`${field}.tags`),
    ...(expectedTurns===undefined?{}:{expectedTurns}),
    ...(contextOverhead===undefined?{}:{contextOverhead}),
    variants:stringList(r.variants,`${field}.variants`),
    ...(quirks?{quirks}:{}),
    source,
  }
}

export function reconcileModelExecutionIdentity(input:{requested?:ModelIdentityRef;selected?:ModelIdentityRef;projected?:ModelIdentityRef;observed?:ModelIdentityRef}):ModelExecutionIdentity{
  const requested=input.requested
  const selected=input.selected
  const projected=input.projected??selected
  const observed=input.observed
  const selectedModel=selected?.model
  const selectedVariant=selected?.variant
  if(selectedModel&&projected?.model&&projected.model!==selectedModel)return{requested,selected,projected,observed,effective:observed,modelVerified:false,variantVerified:selectedVariant?false:undefined,status:'projection-mismatch'}
  if(selectedVariant&&projected?.variant&&projected.variant!==selectedVariant)return{requested,selected,projected,observed,effective:observed,modelVerified:false,variantVerified:false,status:'projection-mismatch'}
  if(!selectedModel||selectedModel==='host-default')return{requested,selected,projected,observed,effective:observed,modelVerified:Boolean(observed?.model),variantVerified:selectedVariant?Boolean(observed?.variant===selectedVariant):undefined,status:'host-default-or-unconstrained'}
  if(!observed?.model)return{requested,selected,projected,observed,effective:observed,modelVerified:false,variantVerified:selectedVariant?false:undefined,status:'model-unverified'}
  if(observed.model!==selectedModel)return{requested,selected,projected,observed,effective:observed,modelVerified:false,variantVerified:selectedVariant?false:undefined,status:'model-mismatch'}
  if(selectedVariant&&!observed.variant)return{requested,selected,projected,observed,effective:observed,modelVerified:true,variantVerified:false,status:'variant-unverified'}
  if(selectedVariant&&observed.variant!==selectedVariant)return{requested,selected,projected,observed,effective:observed,modelVerified:true,variantVerified:false,status:'variant-mismatch'}
  return{requested,selected,projected,observed,effective:observed,modelVerified:true,variantVerified:selectedVariant?true:undefined,status:'verified'}
}
