import type { MissionState } from '../mission/types.js'

export interface RecoveryPlan{
  level:0|1|2|3|4|5|6
  action:'continue'|'same-worker-resume'|'model-escalation'|'narrow-task'|'alternate-plan'|'fresh-worker'|'user-action'
  prompt:string
}

/** Bounded reasoning-stagnation recovery. Provider/tool/permission failures are classified elsewhere. */
export function recoveryPlan(m:MissionState):RecoveryPlan{
  const n=m.continuation.stagnation_count
  if(n<=0)return{level:0,action:'continue',prompt:'Continue the next open obligation from current state.'}
  if(n===1)return{level:1,action:'same-worker-resume',prompt:'Resume the latest reusable worker session with a narrowly scoped corrective instruction.'}
  if(n===2)return{level:2,action:'model-escalation',prompt:'Keep the same task/session when possible, but escalate to the next policy-allowed stronger category/model. Preserve current context and evidence.'}
  if(n===3)return{level:3,action:'narrow-task',prompt:'Decompose the blocked obligation into one smaller independently verifiable task.'}
  if(n===4)return{level:4,action:'alternate-plan',prompt:'Re-plan only the blocked obligation using a materially different bounded strategy. Preserve completed tasks, current evidence, and the same mission contract.'}
  if(n===5)return{level:5,action:'fresh-worker',prompt:'Current context/strategy is exhausted. Use one bounded fresh worker if justified, carrying only the blocker, completed-work summary, affected scope, and evidence.'}
  return{level:6,action:'user-action',prompt:'Bounded recovery is exhausted. Request only the unresolved contract/context decision from the user.'}
}
