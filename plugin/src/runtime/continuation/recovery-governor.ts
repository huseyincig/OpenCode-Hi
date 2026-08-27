import type {MissionState,WorkerState} from '../mission/types.js'
import type {RecoveryPlan} from './recovery.js'

export type RecoveryAttemptOutcome='started'|'completed'|'failed'
export interface RecoveryStrategyContext{task_id?:string;worker_id?:string;model?:string;failure_signature?:string}
export interface RecoveryStrategyRecord extends RecoveryStrategyContext{
  fingerprint:string
  level:number
  action:RecoveryPlan['action']
  progress_signature:string
  generation:number
  attempted_at:number
  outcome:RecoveryAttemptOutcome
}
export interface RecoveryModelHazard{open:boolean;reason:string;task_id?:string;worker_id?:string;model?:string;progress_signature:string;attempts:number;recovery_candidates:string[]}

function fnv(value:string):string{let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0')}
/** Recovery identity deliberately ignores activity-only churn such as worker status/attempt counters. */
export function recoverySemanticSignature(m:MissionState):string{
  const s=m.continuation.semantic_progress_snapshot
  if(!s)return m.continuation.last_progress_signature||'00000000'
  return fnv(JSON.stringify({evidence:s.evidence_ids,invalidated:s.invalidated_evidence_ids,completed_tasks:s.completed_task_ids,completed_dependencies:s.completed_dependency_ids,closed_obligations:s.closed_obligation_ids,changed_files:s.changed_files,terminal_processes:s.terminal_process_ids}))
}
function currentProgressSignature(m:MissionState):string{return recoverySemanticSignature(m)}
function latestRecoveryWorker(m:MissionState):WorkerState|undefined{return[...m.execution.workers].reverse().find(w=>Boolean(w.session_id)&&!['failed','cancelled','busy','starting','queued'].includes(w.status))}
function candidateModels(worker:WorkerState):string[]{return[...new Set([...(worker.fallbacks??[]),...(worker.recovery_candidates??[])].filter(id=>Boolean(id)&&id!==worker.model))]}
export function recoveryModelHazard(m:MissionState):RecoveryModelHazard{
  const progress_signature=currentProgressSignature(m),worker=latestRecoveryWorker(m),task=worker?m.execution.tasks.find(t=>t.id===worker.task_id):undefined
  if(!worker||!task||!worker.model)return{open:false,reason:'no-recoverable-model-worker',progress_signature,attempts:0,recovery_candidates:[]}
  const recovery_candidates=candidateModels(worker)
  const attempts=(m.continuation.recovery_history??[]).filter(item=>item.generation===m.continuation.generation&&item.progress_signature===progress_signature&&item.action==='same-worker-resume'&&item.outcome!=='failed'&&item.task_id===task.id&&item.worker_id===worker.id&&item.model===worker.model).length
  if(!recovery_candidates.length)return{open:false,reason:'no-recovery-model-candidate',task_id:task.id,worker_id:worker.id,model:worker.model,progress_signature,attempts,recovery_candidates}
  if(worker.requested_model&&!worker.fallbacks.length)return{open:false,reason:'explicit-task-model-has-no-authorized-fallback',task_id:task.id,worker_id:worker.id,model:worker.model,progress_signature,attempts,recovery_candidates:[]}
  return{open:attempts>=2,reason:attempts>=2?'same-model-bounded-corrections-exhausted':'same-model-corrections-not-exhausted',task_id:task.id,worker_id:worker.id,model:worker.model,progress_signature,attempts,recovery_candidates}
}
export function recoveryStrategyFingerprint(m:MissionState,plan:Pick<RecoveryPlan,'level'|'action'>):string{return`rg1:${fnv(JSON.stringify({generation:m.continuation.generation,level:plan.level,action:plan.action}))}`}

export function ambiguousConsequentialEffect(m:MissionState):string|undefined{
  if(m.authority?.authority?.executing)return'authority-execution-in-flight'
  const chain=m.release?.release_chain
  if(chain?.push?.outcome==='unknown'&&!chain.push.remote_verified)return'release-push-outcome-unknown'
  if(chain?.tag_push?.outcome==='unknown'&&!chain.tag_push.remote_verified)return'release-tag-push-outcome-unknown'
  if(chain?.release?.outcome==='unknown'&&!chain.release.remote_verified)return'release-create-outcome-unknown'
  if(chain?.package?.outcome==='unknown'&&!chain.package.remote_verified)return'package-publish-outcome-unknown'
  return undefined
}

export function recoveryStrategyEligibility(m:MissionState,plan:Pick<RecoveryPlan,'level'|'action'>):{allowed:boolean;reason:string;fingerprint:string;progress_signature:string}{
  const fingerprint=recoveryStrategyFingerprint(m,plan),progress_signature=currentProgressSignature(m),ambiguous=ambiguousConsequentialEffect(m)
  if(ambiguous)return{allowed:false,reason:ambiguous,fingerprint,progress_signature}
  const repeated=(m.continuation.recovery_history??[]).some(item=>item.fingerprint===fingerprint&&item.progress_signature===progress_signature&&item.outcome!=='failed')
  return repeated?{allowed:false,reason:'strategy-repeated-without-semantic-delta',fingerprint,progress_signature}:{allowed:true,reason:'strategy-admissible',fingerprint,progress_signature}
}

export function recordRecoveryStrategy(m:MissionState,plan:Pick<RecoveryPlan,'level'|'action'>,outcome:RecoveryAttemptOutcome='started',at=Date.now(),context:RecoveryStrategyContext={}):RecoveryStrategyRecord{
  const record:RecoveryStrategyRecord={fingerprint:recoveryStrategyFingerprint(m,plan),level:plan.level,action:plan.action,progress_signature:currentProgressSignature(m),generation:m.continuation.generation,attempted_at:at,outcome,...context}
  const history=[...(m.continuation.recovery_history??[]),record]
  m.continuation.recovery_history=history.slice(-24)
  return record
}

export function isRecoveryStrategyRecord(v:unknown):v is RecoveryStrategyRecord{
  if(!v||typeof v!=='object'||Array.isArray(v))return false
  const x=v as Record<string,unknown>,keys=['fingerprint','level','action','progress_signature','generation','attempted_at','outcome','task_id','worker_id','model','failure_signature']
  if(Object.keys(x).some(k=>!keys.includes(k)))return false
  if(!['task_id','worker_id','model','failure_signature'].every(k=>x[k]===undefined||typeof x[k]==='string'))return false
  return typeof x.fingerprint==='string'&&/^rg1:[a-f0-9]{8}$/.test(x.fingerprint)&&Number.isInteger(x.level)&&Number(x.level)>=0&&Number(x.level)<=6&&['continue','same-worker-resume','model-escalation','narrow-task','alternate-plan','fresh-worker','user-action'].includes(String(x.action))&&typeof x.progress_signature==='string'&&/^[a-f0-9]{8}$/.test(x.progress_signature)&&Number.isInteger(x.generation)&&Number(x.generation)>=1&&typeof x.attempted_at==='number'&&Number.isFinite(x.attempted_at)&&['started','completed','failed'].includes(String(x.outcome))
}
