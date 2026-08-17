import type {Category,MissionState,WorkerState} from '../mission/types.js'
import type {MissionModelFeedback} from './model-resolver.js'

export type ModelFeedbackConfidence='insufficient'|'low'|'medium'|'high'
export type ModelVerificationOutcome='passed'|'failed'|'not-observed'
export interface ModelFeedbackObservation{
  model:string
  role:string
  category:Category
  success:boolean
  retry_count:number
  verification_outcome:ModelVerificationOutcome
  latency_ms?:number
  observed_at:number
}

const DEFAULT_WINDOW=12
function retryCountForFinalModel(w:WorkerState,model:string):number{return(w.fallback_history??[]).filter(h=>h.from===model).length}
function exactAttemptEvidence(m:MissionState,w:WorkerState){
  const generation=w.generation_at_spawn??m.continuation.generation,ordinal=w.attempt??0
  return m.execution.evidence.items.filter(e=>e.task_id===w.task_id&&!e.invalidated_at&&e.producer_attempt?.worker_id===w.id&&e.producer_attempt.ordinal===ordinal&&e.producer_attempt.generation===generation)
}
function verificationOutcome(m:MissionState,w:WorkerState):ModelVerificationOutcome{
  const evidence=exactAttemptEvidence(m,w)
  if(evidence.some(e=>e.outcome==='failed'||e.pass===false))return'failed'
  if(evidence.some(e=>e.outcome==='passed'||e.pass===true))return'passed'
  return'not-observed'
}
function confidence(samples:number):ModelFeedbackConfidence{return samples>=8?'high':samples>=4?'medium':samples>=2?'low':'insufficient'}
export function missionModelFeedbackObservations(m:MissionState,role?:string,category?:Category,window=DEFAULT_WINDOW):ModelFeedbackObservation[]{
  const eligible=m.execution.workers.filter(w=>(!role||w.role===role)&&(!category||w.category===category)&&Boolean(w.effective_model??w.model)&&['completed','failed'].includes(w.status))
  return eligible.sort((a,b)=>(b.completed_at??b.updated_at??0)-(a.completed_at??a.updated_at??0)).slice(0,Math.max(1,Math.min(32,window))).map(w=>{
    const model=String(w.effective_model??w.model),started=w.started_at,completed=w.completed_at,verification_outcome=verificationOutcome(m,w)
    return{model,role:w.role,category:w.category,success:w.status==='completed'&&verification_outcome!=='failed',retry_count:retryCountForFinalModel(w,model),verification_outcome,...(started&&completed&&completed>=started?{latency_ms:completed-started}:{}),observed_at:completed??w.updated_at??m.identity.updated_at}
  })
}
export function deriveMissionModelFeedback(m:MissionState,role?:string,category?:Category,window=DEFAULT_WINDOW):MissionModelFeedback{
  const workers=m.execution.workers.filter(w=>(!role||w.role===role)&&(!category||w.category===category)&&['completed','failed'].includes(w.status)).sort((a,b)=>(b.completed_at??b.updated_at??0)-(a.completed_at??a.updated_at??0)).slice(0,Math.max(1,Math.min(32,window)))
  const observations=missionModelFeedbackObservations(m,role,category,window),failures:Record<string,number>={},successes:Record<string,number>={},retries:Record<string,number>={},samples:Record<string,number>={},average_latency_ms:Record<string,number>={},verification_passes:Record<string,number>={},verification_failures:Record<string,number>={},latencies:Record<string,number[]>={}
  const inc=(r:Record<string,number>,id:string,n=1)=>r[id]=(r[id]??0)+n
  for(const o of observations){inc(samples,o.model);inc(o.success?successes:failures,o.model);if(o.verification_outcome==='passed')inc(verification_passes,o.model);if(o.verification_outcome==='failed')inc(verification_failures,o.model);if(o.latency_ms!==undefined)(latencies[o.model]??=[]).push(o.latency_ms)}
  // Every fallback transition is a concrete failed/retried model attempt. Attribute it to `from`,
  // not to the final model that eventually completed the worker.
  for(const worker of workers){const finalModel=String(worker.effective_model??worker.model??'');for(const transition of worker.fallback_history??[]){if(!transition.from)continue;inc(retries,transition.from);if(transition.from!==finalModel){inc(samples,transition.from);inc(failures,transition.from)}}}
  for(const [model,xs] of Object.entries(latencies))average_latency_ms[model]=Math.round(xs.reduce((a,b)=>a+b,0)/xs.length)
  const models=new Set([...Object.keys(samples),...Object.keys(retries)]),confidence_by_model=Object.fromEntries([...models].map(model=>[model,confidence(samples[model]??0)])) as Record<string,ModelFeedbackConfidence>
  return{failures,successes,retries,samples,confidence:confidence_by_model,average_latency_ms,verification_passes,verification_failures,window_size:workers.length}
}
