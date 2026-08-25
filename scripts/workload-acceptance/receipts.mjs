import {createHash,randomUUID} from 'node:crypto'
import {existsSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {join} from 'node:path'
export const RECEIPT_KINDS=Object.freeze(['run-identity','product-identity','fixture-identity','prompt-identity','oracle-identity','tool-preflight','model-role-selection','execution','liveness','role-acceptance','oracle-result','classification','reference','repair','lineage','cleanup','acceptance-gates','summary','receipt-correction'])
const canonical=v=>JSON.stringify(v,Object.keys(v).sort(),2)+'\n'
export class ImmutableReceiptWriter{
  constructor(root,runId){this.root=root;this.runId=runId;mkdirSync(root,{recursive:true})}
  write(kind,payload){if(!RECEIPT_KINDS.includes(kind))throw new Error(`UNKNOWN_RECEIPT_KIND:${kind}`);const path=join(this.root,`${kind}.json`),body=JSON.stringify({schema:1,kind,run_id:this.runId,...payload},null,2)+'\n';try{writeFileSync(path,body,{flag:'wx',mode:0o600})}catch(e){if(e?.code==='EEXIST')throw new Error(`IMMUTABLE_RECEIPT_EXISTS:${kind}`);throw e}return{path,sha256:createHash('sha256').update(body).digest('hex')}}
  read(kind){return JSON.parse(readFileSync(join(this.root,`${kind}.json`),'utf8'))}
}
export function readEffectiveReceipt(root,kind,runId){
  if(kind==='receipt-correction')throw new Error('RECEIPT_CORRECTION_CANNOT_TARGET_ITSELF')
  const path=join(root,`${kind}.json`),body=readFileSync(path),original=JSON.parse(body),correctionPath=join(root,'receipt-correction.json')
  if(!existsSync(correctionPath))return original
  const correction=JSON.parse(readFileSync(correctionPath,'utf8'))
  if(correction?.schema!==1||correction?.kind!=='receipt-correction'||correction?.run_id!==runId||!Array.isArray(correction?.targets))throw new Error(`RECEIPT_CORRECTION_INVALID:${runId}`)
  const seen=new Set(),patches=new Map()
  for(const target of correction.targets){
    const targetKind=String(target?.kind??'')
    if(!RECEIPT_KINDS.includes(targetKind)||targetKind==='receipt-correction'||seen.has(targetKind))throw new Error(`RECEIPT_CORRECTION_TARGET_INVALID:${runId}:${targetKind}`)
    seen.add(targetKind)
    const targetPath=join(root,`${targetKind}.json`);if(!existsSync(targetPath))throw new Error(`RECEIPT_CORRECTION_TARGET_MISSING:${runId}:${targetKind}`)
    const targetBody=readFileSync(targetPath),actual=createHash('sha256').update(targetBody).digest('hex')
    if(target?.original_sha256!==actual)throw new Error(`RECEIPT_CORRECTION_HASH_MISMATCH:${runId}:${targetKind}`)
    if(!target?.patch||typeof target.patch!=='object'||Array.isArray(target.patch)||['schema','kind','run_id'].some(key=>key in target.patch))throw new Error(`RECEIPT_CORRECTION_PATCH_INVALID:${runId}:${targetKind}`)
    patches.set(targetKind,target.patch)
  }
  return patches.has(kind)?{...original,...patches.get(kind)}:original
}
export function createRunId(workloadId){return `${workloadId}-${Date.now().toString(36)}-${randomUUID().slice(0,8)}`}
export function admitRerunLineage({predecessorRunId,predecessorCondition,currentCondition,repairReceipt,materialChangeReceipt}){if(!predecessorRunId)return{allowed:true,reason:'initial-run'};if(predecessorCondition===currentCondition&&!repairReceipt&&!materialChangeReceipt)throw new Error('BLIND_RERUN_FORBIDDEN');if(predecessorCondition!==currentCondition&&!materialChangeReceipt&&!repairReceipt)throw new Error('MATERIAL_CHANGE_RECEIPT_REQUIRED');return{allowed:true,reason:repairReceipt?'repair-reexecution':'material-condition-change',predecessor_run_id:predecessorRunId}}
