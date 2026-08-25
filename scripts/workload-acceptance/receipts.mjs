import {createHash,randomUUID} from 'node:crypto'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {join} from 'node:path'
export const RECEIPT_KINDS=Object.freeze(['run-identity','product-identity','fixture-identity','prompt-identity','oracle-identity','tool-preflight','model-role-selection','execution','liveness','role-acceptance','oracle-result','classification','reference','repair','lineage','cleanup','summary'])
const canonical=v=>JSON.stringify(v,Object.keys(v).sort(),2)+'\n'
export class ImmutableReceiptWriter{
  constructor(root,runId){this.root=root;this.runId=runId;mkdirSync(root,{recursive:true})}
  write(kind,payload){if(!RECEIPT_KINDS.includes(kind))throw new Error(`UNKNOWN_RECEIPT_KIND:${kind}`);const path=join(this.root,`${kind}.json`),body=JSON.stringify({schema:1,kind,run_id:this.runId,...payload},null,2)+'\n';try{writeFileSync(path,body,{flag:'wx',mode:0o600})}catch(e){if(e?.code==='EEXIST')throw new Error(`IMMUTABLE_RECEIPT_EXISTS:${kind}`);throw e}return{path,sha256:createHash('sha256').update(body).digest('hex')}}
  read(kind){return JSON.parse(readFileSync(join(this.root,`${kind}.json`),'utf8'))}
}
export function createRunId(workloadId){return `${workloadId}-${Date.now().toString(36)}-${randomUUID().slice(0,8)}`}
export function admitRerunLineage({predecessorRunId,predecessorCondition,currentCondition,repairReceipt,materialChangeReceipt}){if(!predecessorRunId)return{allowed:true,reason:'initial-run'};if(predecessorCondition===currentCondition&&!repairReceipt&&!materialChangeReceipt)throw new Error('BLIND_RERUN_FORBIDDEN');if(predecessorCondition!==currentCondition&&!materialChangeReceipt&&!repairReceipt)throw new Error('MATERIAL_CHANGE_RECEIPT_REQUIRED');return{allowed:true,reason:repairReceipt?'repair-reexecution':'material-condition-change',predecessor_run_id:predecessorRunId}}
