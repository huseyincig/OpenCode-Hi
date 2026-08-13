import { assertCanonicalId, assertContentHash, assertNonEmptyString, assertPositiveInteger, assertRecord, assertStrictKeys, canonicalHash, compareTechnicalId, contentHash, ContractValidationError, type ContentHash } from './common.js'

export type ProvenanceSourceType='builtin'|'project'|'external-source'|'generated'|'runtime-observation'

export interface FileHash { path:string; hash:ContentHash }
export interface ProvenanceRecord{
  sourceType:ProvenanceSourceType
  sourceId:string
  sourceRevision?:string
  sourceHash?:ContentHash
  transform?:string
  owner:string
  fileHashes?:FileHash[]
}

const SOURCE_TYPES=new Set<ProvenanceSourceType>(['builtin','project','external-source','generated','runtime-observation'])

function assertRelativePath(value:unknown,field:string):string{
  const path=assertNonEmptyString(value,field).replace(/\\/g,'/')
  if(path.startsWith('/')||path.split('/').includes('..'))throw new ContractValidationError(field,'must be a bounded relative path')
  return path
}

export function validateProvenanceRecord(value:unknown,field='provenance'):ProvenanceRecord{
  const record=assertRecord(value,field)
  assertStrictKeys(record,['sourceType','sourceId','sourceRevision','sourceHash','transform','owner','fileHashes'],['sourceType','sourceId','owner'],field)
  if(typeof record.sourceType!=='string'||!SOURCE_TYPES.has(record.sourceType as ProvenanceSourceType))throw new ContractValidationError(`${field}.sourceType`,'unsupported provenance source type')
  const sourceId=assertNonEmptyString(record.sourceId,`${field}.sourceId`)
  const owner=assertCanonicalId(record.owner,`${field}.owner`)
  const sourceRevision=record.sourceRevision===undefined?undefined:assertNonEmptyString(record.sourceRevision,`${field}.sourceRevision`)
  const sourceHash=record.sourceHash===undefined?undefined:assertContentHash(record.sourceHash,`${field}.sourceHash`)
  const transform=record.transform===undefined?undefined:assertNonEmptyString(record.transform,`${field}.transform`)
  let fileHashes:FileHash[]|undefined
  if(record.fileHashes!==undefined){
    if(!Array.isArray(record.fileHashes))throw new ContractValidationError(`${field}.fileHashes`,'must be an array')
    const seen=new Set<string>()
    fileHashes=record.fileHashes.map((raw,index)=>{
      const item=assertRecord(raw,`${field}.fileHashes[${index}]`)
      assertStrictKeys(item,['path','hash'],['path','hash'],`${field}.fileHashes[${index}]`)
      const path=assertRelativePath(item.path,`${field}.fileHashes[${index}].path`)
      if(seen.has(path))throw new ContractValidationError(`${field}.fileHashes`,`duplicate path ${path}`)
      seen.add(path)
      return{path,hash:assertContentHash(item.hash,`${field}.fileHashes[${index}].hash`)}
    }).sort((a,b)=>compareTechnicalId(a.path,b.path))
  }
  return{sourceType:record.sourceType as ProvenanceSourceType,sourceId,owner,...(sourceRevision?{sourceRevision}:{}),...(sourceHash?{sourceHash}:{}),...(transform?{transform}:{}),...(fileHashes?{fileHashes}:{})}
}

export interface ProjectionSourceContract { id:string; hash:ContentHash }
export interface ProjectionReceipt{
  schemaVersion:1
  projectionSchema:string
  sourceContracts:ProjectionSourceContract[]
  generatorId:string
  generatorVersion:string
  outputPath:string
  outputHash:ContentHash
}

export interface CreateProjectionReceiptInput{
  projectionSchema:string
  sourceContracts:Array<{id:string;contract:unknown}>
  generatorId:string
  generatorVersion:string
  outputPath:string
  outputContent:string
}

export function createProjectionReceipt(input:CreateProjectionReceiptInput):ProjectionReceipt{
  const projectionSchema=assertCanonicalId(input.projectionSchema,'projectionSchema')
  const generatorId=assertCanonicalId(input.generatorId,'generatorId')
  const generatorVersion=assertNonEmptyString(input.generatorVersion,'generatorVersion')
  const outputPath=assertRelativePath(input.outputPath,'outputPath')
  if(!Array.isArray(input.sourceContracts)||!input.sourceContracts.length)throw new ContractValidationError('sourceContracts','at least one canonical source contract is required')
  const seen=new Set<string>()
  const sourceContracts=input.sourceContracts.map((item,index)=>{
    const id=assertCanonicalId(item.id,`sourceContracts[${index}].id`)
    if(seen.has(id))throw new ContractValidationError('sourceContracts',`duplicate contract ${id}`)
    seen.add(id)
    return{id,hash:canonicalHash(item.contract)}
  }).sort((a,b)=>compareTechnicalId(a.id,b.id))
  return{schemaVersion:1,projectionSchema,sourceContracts,generatorId,generatorVersion,outputPath,outputHash:contentHash(input.outputContent)}
}

export function validateProjectionReceipt(value:unknown,field='receipt'):ProjectionReceipt{
  const record=assertRecord(value,field)
  assertStrictKeys(record,['schemaVersion','projectionSchema','sourceContracts','generatorId','generatorVersion','outputPath','outputHash'],['schemaVersion','projectionSchema','sourceContracts','generatorId','generatorVersion','outputPath','outputHash'],field)
  if(assertPositiveInteger(record.schemaVersion,`${field}.schemaVersion`)!==1)throw new ContractValidationError(`${field}.schemaVersion`,'unsupported version')
  if(!Array.isArray(record.sourceContracts)||!record.sourceContracts.length)throw new ContractValidationError(`${field}.sourceContracts`,'must be a non-empty array')
  const seen=new Set<string>()
  const sourceContracts=record.sourceContracts.map((raw,index)=>{
    const item=assertRecord(raw,`${field}.sourceContracts[${index}]`)
    assertStrictKeys(item,['id','hash'],['id','hash'],`${field}.sourceContracts[${index}]`)
    const id=assertCanonicalId(item.id,`${field}.sourceContracts[${index}].id`)
    if(seen.has(id))throw new ContractValidationError(`${field}.sourceContracts`,`duplicate contract ${id}`)
    seen.add(id)
    return{id,hash:assertContentHash(item.hash,`${field}.sourceContracts[${index}].hash`)}
  }).sort((a,b)=>compareTechnicalId(a.id,b.id))
  return{
    schemaVersion:1,
    projectionSchema:assertCanonicalId(record.projectionSchema,`${field}.projectionSchema`),
    sourceContracts,
    generatorId:assertCanonicalId(record.generatorId,`${field}.generatorId`),
    generatorVersion:assertNonEmptyString(record.generatorVersion,`${field}.generatorVersion`),
    outputPath:assertRelativePath(record.outputPath,`${field}.outputPath`),
    outputHash:assertContentHash(record.outputHash,`${field}.outputHash`),
  }
}

export function projectionReceiptHash(receipt:ProjectionReceipt):ContentHash{return canonicalHash(validateProjectionReceipt(receipt))}
