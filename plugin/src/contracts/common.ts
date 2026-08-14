import { createHash } from 'node:crypto'

export type ContractStatus='DRAFT'|'VALIDATED'|'ADMITTED'|'RETIRED'
export type LifecycleClass='CANONICAL'|'DERIVED'|'CACHE'|'EPHEMERAL'
export type StorageScope='PROJECT'|'GLOBAL'|'RUNTIME'
export type Confidence='unknown'|'low'|'medium'|'high'
export type CapabilityLevel='unknown'|'low'|'medium'|'high'
export type TriStateCapability='unknown'|false|true
export type HashAlgorithm='sha256'

export interface ContentHash { algorithm:HashAlgorithm; value:string }

export class ContractValidationError extends Error{
  constructor(public readonly field:string,message:string){super(`${field}: ${message}`);this.name='ContractValidationError'}
}

export function isRecord(value:unknown):value is Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))return false
  const proto=Object.getPrototypeOf(value)
  return proto===Object.prototype||proto===null
}

export function assertRecord(value:unknown,field:string):Record<string,unknown>{
  if(!isRecord(value))throw new ContractValidationError(field,'must be a plain object')
  return value
}

export function assertStrictKeys(value:Record<string,unknown>,allowed:readonly string[],required:readonly string[],field:string):void{
  const allow=new Set(allowed)
  for(const key of Object.keys(value))if(!allow.has(key))throw new ContractValidationError(`${field}.${key}`,'unknown field')
  for(const key of required)if(!(key in value))throw new ContractValidationError(`${field}.${key}`,'required field missing')
}

export function assertNonEmptyString(value:unknown,field:string):string{
  if(typeof value!=='string'||!value.trim())throw new ContractValidationError(field,'must be a non-empty string')
  return value
}

const CANONICAL_ID=/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/
export function assertCanonicalId(value:unknown,field='id'):string{
  const id=assertNonEmptyString(value,field)
  if(!CANONICAL_ID.test(id))throw new ContractValidationError(field,'must use canonical lowercase technical ID syntax')
  return id
}

export function assertPositiveInteger(value:unknown,field:string):number{
  if(!Number.isInteger(value)||Number(value)<1)throw new ContractValidationError(field,'must be a positive integer')
  return Number(value)
}

export function compareTechnicalId(a:string,b:string):number{return a<b?-1:a>b?1:0}

export function isSafeProjectFileSourceRef(value:unknown):value is string{
  if(typeof value!=='string'||!value.startsWith('file:'))return false
  const rel=value.slice(5);if(!rel||rel.startsWith('/')||rel.includes('\\')||rel.includes('\0'))return false
  const segments=rel.split('/');if(segments.some(segment=>!segment||segment==='.'||segment==='..'))return false
  if(/^[A-Za-z]:$/.test(segments[0]))return false
  return true
}

export function contentHash(value:string):ContentHash{
  return{algorithm:'sha256',value:createHash('sha256').update(value).digest('hex')}
}

export function assertContentHash(value:unknown,field:string):ContentHash{
  const record=assertRecord(value,field)
  assertStrictKeys(record,['algorithm','value'],['algorithm','value'],field)
  if(record.algorithm!=='sha256')throw new ContractValidationError(`${field}.algorithm`,'must be sha256')
  if(typeof record.value!=='string'||!/^[a-f0-9]{64}$/.test(record.value))throw new ContractValidationError(`${field}.value`,'must be 64 lowercase hexadecimal SHA-256 characters')
  return{algorithm:'sha256',value:record.value}
}

function normalizeCanonical(value:unknown,path:string):unknown{
  if(value===null||typeof value==='string'||typeof value==='boolean')return value
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new ContractValidationError(path,'non-finite numbers are not canonical')
    return value
  }
  if(Array.isArray(value))return value.map((item,index)=>normalizeCanonical(item,`${path}[${index}]`))
  if(isRecord(value)){
    const out:Record<string,unknown>={}
    for(const key of Object.keys(value).sort()){
      const item=value[key]
      if(item===undefined)throw new ContractValidationError(`${path}.${key}`,'undefined is not canonical')
      out[key]=normalizeCanonical(item,`${path}.${key}`)
    }
    return out
  }
  throw new ContractValidationError(path,`unsupported canonical value type ${typeof value}`)
}

export function stableJson(value:unknown):string{return JSON.stringify(normalizeCanonical(value,'$'))}
export function canonicalHash(value:unknown):ContentHash{return contentHash(stableJson(value))}
export function hashesEqual(a:ContentHash,b:ContentHash):boolean{return a.algorithm===b.algorithm&&a.value===b.value}
