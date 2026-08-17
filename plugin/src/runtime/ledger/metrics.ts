import type { MissionState } from '../mission/types.js'
import { workerDerivedOpenCodeCost,workerExactTokenUsage } from '../economics/usage-runtime.js'

export interface MissionMetrics {
  completed: boolean
  duration_ms: number
  agents_spawned: number
  tasks_created:number
  zero_methodology_workers:number
  methodologies_loaded_total:number
  average_methodologies_per_worker:number
  handoff_events:number
  average_handoff_chars:number
  max_handoff_chars:number
  same_session_resumes:number
  team_mode_used:boolean
  duplicate_work_events: number
  user_interruptions: number
  premature_stop_blocks: number
  stale_verification_blocks: number
  continuation_recovery_events: number
  continuation_recovery_success: number
  evidence_items: number
  failed_workers: number
  usage:{complete_observations:number;partial_observations:number;exact_complete_tokens:{input:number;output:number;reasoning:number;cache_read:number;cache_write:number};derived_opencode_cost_usd:number;monetary_basis:'opencode-calculated-derived'}
}

export function missionMetrics(m: MissionState): MissionMetrics {
  const events=m.execution.ledger
  const count=(pred:(type:string,payload:Record<string,unknown>|undefined)=>boolean)=>events.filter(e=>pred(e.type,e.payload)).length
  const recovery=count((t,p)=>t==='runtime.decision'&&p?.decision==='RECOVER')
  const recoverySuccess=count((t,p)=>t==='runtime.decision'&&p?.decision==='RECOVER'&&String(p?.reason??'').includes('level-1'))
  const handoffs=events.filter(e=>e.type==='worker.handoff').map(e=>Number(e.payload?.chars??0)).filter(n=>Number.isFinite(n)&&n>=0)
  const methodologyCounts=m.execution.workers.map(w=>w.selected_methodologies.length)
  const completeObservations=m.execution.workers.flatMap(w=>w.usage_observations??[]).filter(x=>x.coverage==='assistant-step-total'),partialObservations=m.execution.workers.flatMap(w=>w.usage_observations??[]).filter(x=>x.coverage!=='assistant-step-total')
  const exactCompleteTokens=m.execution.workers.map(workerExactTokenUsage).reduce((a,b)=>({input:a.input+b.input,output:a.output+b.output,reasoning:a.reasoning+b.reasoning,cache_read:a.cache_read+b.cache_read,cache_write:a.cache_write+b.cache_write}),{input:0,output:0,reasoning:0,cache_read:0,cache_write:0}),derivedOpenCodeCost=m.execution.workers.reduce((sum,w)=>sum+workerDerivedOpenCodeCost(w),0)
  const avg=(xs:number[])=>xs.length?Math.round(xs.reduce((a,b)=>a+b,0)/xs.length):0
  return {
    completed:m.identity.status==='completed',
    duration_ms:Math.max(0,m.identity.updated_at-m.identity.created_at),
    agents_spawned:m.execution.workers.length,
    tasks_created:m.execution.tasks.length,
    zero_methodology_workers:methodologyCounts.filter(n=>n===0).length,
    methodologies_loaded_total:methodologyCounts.reduce((a,b)=>a+b,0),
    average_methodologies_per_worker:avg(methodologyCounts),
    handoff_events:handoffs.length,
    average_handoff_chars:avg(handoffs),
    max_handoff_chars:handoffs.length?Math.max(...handoffs):0,
    same_session_resumes:count(t=>t==='worker.resumed'||t==='worker.model-escalated'),
    team_mode_used:events.some(e=>e.type==='team.created'),
    duplicate_work_events:count(t=>t.includes('duplicate')||t.includes('dedup')),
    user_interruptions:m.continuation.resume_count??(m.continuation.user_interrupted?1:0),
    premature_stop_blocks:count((t,p)=>t==='runtime.decision'&&p?.decision==='STOP_BLOCKED'),
    stale_verification_blocks:count((t,p)=>t==='runtime.decision'&&String(p?.reason??'').includes('stale')),
    continuation_recovery_events:recovery,
    continuation_recovery_success:recoverySuccess,
    evidence_items:m.execution.evidence.items.length,
    failed_workers:m.execution.workers.filter(w=>w.status==='failed').length,
    usage:{complete_observations:completeObservations.length,partial_observations:partialObservations.length,exact_complete_tokens:exactCompleteTokens,derived_opencode_cost_usd:Number(derivedOpenCodeCost.toFixed(12)),monetary_basis:'opencode-calculated-derived'},
  }
}

export function aggregateMissionMetrics(missions:MissionState[]):Record<string,unknown>{
  const rows=missions.map(missionMetrics);const completed=rows.filter(x=>x.completed)
  const avg=(xs:number[])=>xs.length?Math.round(xs.reduce((a,b)=>a+b,0)/xs.length):0
  return {
    missions:rows.length,
    completed:completed.length,
    completion_rate:rows.length?completed.length/rows.length:0,
    average_duration_ms:avg(completed.map(x=>x.duration_ms)),
    average_agents_spawned:avg(rows.map(x=>x.agents_spawned)),
    average_tasks_created:avg(rows.map(x=>x.tasks_created)),
    zero_methodology_workers:rows.reduce((n,x)=>n+x.zero_methodology_workers,0),
    methodologies_loaded_total:rows.reduce((n,x)=>n+x.methodologies_loaded_total,0),
    average_methodologies_per_worker:avg(rows.map(x=>x.average_methodologies_per_worker)),
    average_handoff_chars:avg(rows.flatMap(x=>x.handoff_events?[x.average_handoff_chars]:[])),
    max_handoff_chars:rows.length?Math.max(...rows.map(x=>x.max_handoff_chars)):0,
    same_session_resumes:rows.reduce((n,x)=>n+x.same_session_resumes,0),
    team_mode_missions:rows.filter(x=>x.team_mode_used).length,
    user_interruptions:rows.reduce((n,x)=>n+x.user_interruptions,0),
    duplicate_work_events:rows.reduce((n,x)=>n+x.duplicate_work_events,0),
    stale_verification_blocks:rows.reduce((n,x)=>n+x.stale_verification_blocks,0),
    premature_stop_blocks:rows.reduce((n,x)=>n+x.premature_stop_blocks,0),
    continuation_recovery_events:rows.reduce((n,x)=>n+x.continuation_recovery_events,0),
    continuation_recovery_success:rows.reduce((n,x)=>n+x.continuation_recovery_success,0),
    failed_workers:rows.reduce((n,x)=>n+x.failed_workers,0),
    usage:{complete_observations:rows.reduce((n,x)=>n+x.usage.complete_observations,0),partial_observations:rows.reduce((n,x)=>n+x.usage.partial_observations,0),exact_complete_tokens:rows.reduce((a,x)=>({input:a.input+x.usage.exact_complete_tokens.input,output:a.output+x.usage.exact_complete_tokens.output,reasoning:a.reasoning+x.usage.exact_complete_tokens.reasoning,cache_read:a.cache_read+x.usage.exact_complete_tokens.cache_read,cache_write:a.cache_write+x.usage.exact_complete_tokens.cache_write}),{input:0,output:0,reasoning:0,cache_read:0,cache_write:0}),derived_opencode_cost_usd:Number(rows.reduce((n,x)=>n+x.usage.derived_opencode_cost_usd,0).toFixed(12)),monetary_basis:'opencode-calculated-derived'},
    note:'Hi does not fabricate unavailable token/cost telemetry. Complete token totals use exact OpenCode step-finish observations only. Assistant-level fallback usage is reported separately as partial coverage. Monetary values labeled derived_opencode_cost_usd are OpenCode-calculated values, not claimed provider-billed cost. Routing expected_completion_cost remains heuristic.',
  }
}
