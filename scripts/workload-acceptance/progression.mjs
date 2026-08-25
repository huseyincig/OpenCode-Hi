import {existsSync,readFileSync,readdirSync} from 'node:fs'
import {join} from 'node:path'
import {WORKLOAD_IDS} from './catalog.mjs'
import {readEffectiveReceipt} from './receipts.mjs'

export const ACCEPTANCE_PASS='ACCEPTANCE_PASS'
const PASS_ONLY_START='W02'
const requiredReceiptKinds=Object.freeze(['run-identity','product-identity','fixture-identity','prompt-identity','oracle-identity','tool-preflight','model-role-selection','execution','liveness','role-acceptance','oracle-result','classification','lineage','cleanup','acceptance-gates','summary'])

function ordinal(runId,workloadId){const m=new RegExp(`^${workloadId}-([0-9a-z]+)-`).exec(String(runId));return m?Number.parseInt(m[1],36):-1}
function runIdMatches(row,runId){return row&&row.run_id===runId}

export function evaluateAcceptancePass({summary,classification,oracleResult,cleanup,acceptanceGates,receiptIntegrity=true,invalidated=false}={}){
  const reasons=[]
  if(invalidated||summary?.acceptance_valid===false)reasons.push('invalidated-run')
  if(summary?.status!=='PASS')reasons.push('summary-not-pass')
  if(summary?.mission_status!=='completed')reasons.push('mission-not-completed')
  if(summary?.oracle_pass!==true)reasons.push('summary-oracle-not-pass')
  if(classification?.result!=='PASS'||classification?.class!==ACCEPTANCE_PASS)reasons.push('classification-not-acceptance-pass')
  if(oracleResult?.passed!==true)reasons.push('oracle-not-pass')
  const r=oracleResult?.result
  if(!r||!Number.isInteger(r.total)||r.total<=0||!Number.isInteger(r.passed)||!Number.isInteger(r.failed)||r.failed!==0||r.passed!==r.total)reasons.push('oracle-not-full-pass')
  if(!acceptanceGates||acceptanceGates.acceptance_pass!==true)reasons.push('acceptance-gates-not-pass')
  for(const key of ['terminal_run','mission_completed','hidden_oracle_full_pass','mandatory_acceptance_evidence_complete','model_pool_confined','no_scope_violation','no_supervisor_error','no_unresolved_blocker','receipt_integrity','run_valid','cleanup_valid'])if(acceptanceGates?.checks?.[key]!==true)reasons.push(`gate:${key}`)
  if(!receiptIntegrity)reasons.push('receipt-integrity-failed')
  if(!cleanup||!Array.isArray(cleanup.quarantined)||cleanup.quarantined.length!==0)reasons.push('cleanup-invalid')
  return{pass:reasons.length===0,reasons}
}

export function loadRunAcceptanceEvidence(runtimeRoot,workloadId,runId){
  const rr=join(runtimeRoot,workloadId,'runs',runId,'receipts'),rows={};let receiptIntegrity=true
  for(const kind of requiredReceiptKinds){try{const row=readEffectiveReceipt(rr,kind,runId);if(!runIdMatches(row,runId))throw new Error(`RUN_ID_MISMATCH:${kind}`);rows[kind]=row}catch{receiptIntegrity=false;rows[kind]=null}}
  const invalidated=rows.summary?.acceptance_valid===false||rows['acceptance-gates']?.checks?.run_valid===false
  return{run_id:runId,receipt_integrity:receiptIntegrity,summary:rows.summary,classification:rows.classification,oracleResult:rows['oracle-result'],cleanup:rows.cleanup,acceptanceGates:rows['acceptance-gates'],invalidated,evaluation:evaluateAcceptancePass({summary:rows.summary,classification:rows.classification,oracleResult:rows['oracle-result'],cleanup:rows.cleanup,acceptanceGates:rows['acceptance-gates'],receiptIntegrity,invalidated})}
}

export function findAcceptancePassRun(runtimeRoot,workloadId){
  const runs=join(runtimeRoot,workloadId,'runs');if(!existsSync(runs))return null
  const ids=readdirSync(runs,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name).sort((a,b)=>ordinal(b,workloadId)-ordinal(a,workloadId)||b.localeCompare(a))
  for(const id of ids){const evidence=loadRunAcceptanceEvidence(runtimeRoot,workloadId,id);if(evidence.evaluation.pass)return evidence}
  return null
}

export function assertPassOnlyWorkloadAdmission(workloadId,{state,runtimeRoot}){
  if(!WORKLOAD_IDS.includes(workloadId))throw new Error(`W_PROGRESSION_UNKNOWN_WORKLOAD:${workloadId}`)
  if(state?.active_workload!==workloadId)throw new Error(`W_PROGRESSION_NOT_CANONICAL_ACTIVE:${workloadId}:${String(state?.active_workload)}`)
  const currentState=String(state?.workloads?.[workloadId]??'')
  if(!/(READY|ACTIVE|REEXECUTION|REPAIRING)/.test(currentState))throw new Error(`W_PROGRESSION_WORKLOAD_NOT_ADMITTED:${workloadId}:${currentState}`)
  const start=WORKLOAD_IDS.indexOf(PASS_ONLY_START),index=WORKLOAD_IDS.indexOf(workloadId)
  if(index<=start)return{allowed:true,predecessor_acceptance:null}
  const predecessor=WORKLOAD_IDS[index-1],evidence=findAcceptancePassRun(runtimeRoot,predecessor)
  if(!evidence)throw new Error(`W_PROGRESSION_PREDECESSOR_NOT_ACCEPTED:${predecessor}->${workloadId}`)
  if(String(state?.workloads?.[predecessor]??'')!=='CLOSED_ACCEPTANCE_PASS')throw new Error(`W_PROGRESSION_PREDECESSOR_STATE_NOT_ACCEPTED:${predecessor}`)
  return{allowed:true,predecessor_acceptance:evidence.run_id}
}

export function advanceToNextWorkload(state,current,evidence){
  const index=WORKLOAD_IDS.indexOf(current);if(index<0)throw new Error(`W_PROGRESSION_UNKNOWN_WORKLOAD:${current}`)
  const evaluation=evidence?.evaluation??evaluateAcceptancePass(evidence)
  if(!evaluation.pass)throw new Error(`W_PROGRESSION_ADVANCE_FORBIDDEN:${current}:${evaluation.reasons.join(',')}`)
  const next=WORKLOAD_IDS[index+1]??null,out=structuredClone(state)
  out.workloads??={};out.workloads[current]='CLOSED_ACCEPTANCE_PASS';out.authoritative_run=null
  if(next){out.status='READY';out.active_workload=next;out.workloads[next]='READY_NOT_STARTED'}else{out.status='COMPLETE';out.active_workload=null}
  return{state:out,next_workload:next,accepted_run_id:evidence?.run_id??evidence?.run_id??null}
}

export function assertReceiptIntegrity(receipts,runId,kinds){for(const kind of kinds){const row=receipts.read(kind);if(row?.run_id!==runId)throw new Error(`W_RECEIPT_INTEGRITY_FAILED:${kind}`)}return true}
