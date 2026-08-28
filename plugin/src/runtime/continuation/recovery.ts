import type { MissionState } from '../mission/types.js'
import { recoveryModelHazard,recoveryStrategyEligibility } from './recovery-governor.js'

export interface RecoveryPlan{
  level:0|1|2|3|4|5|6
  action:'continue'|'same-worker-resume'|'model-escalation'|'narrow-task'|'alternate-plan'|'fresh-worker'|'user-action'
  prompt:string
}

function planForLevel(level:0|1|2|3|4|5|6):RecoveryPlan{
  if(level===0)return{level:0,action:'continue',prompt:'Continue the next open obligation from current state.'}
  if(level===1)return{level:1,action:'same-worker-resume',prompt:'Resume the latest reusable worker session with a narrowly scoped corrective instruction.'}
  if(level===2)return{level:2,action:'same-worker-resume',prompt:'Resume the SAME task/session/model with a materially different corrective hypothesis or action. Preserve completed work and evidence; do not restart top-level planning or change models.'}
  if(level===3)return{level:3,action:'narrow-task',prompt:'Decompose the blocked obligation into one smaller independently verifiable task.'}
  if(level===4)return{level:4,action:'alternate-plan',prompt:'Re-plan only the blocked obligation using a materially different bounded strategy. Preserve completed tasks, current evidence, and the same mission contract.'}
  if(level===5)return{level:5,action:'fresh-worker',prompt:'Current context/strategy is exhausted. Use one bounded fresh worker if justified, carrying only the blocker, completed-work summary, affected scope, and evidence.'}
  return{level:6,action:'user-action',prompt:'Bounded recovery is exhausted. Request only the unresolved contract/context decision from the user.'}
}

/** Bounded reasoning-stagnation recovery with replay prevention on unchanged semantic state. */
export function recoveryPlan(m:MissionState):RecoveryPlan{
  const n=m.continuation.stagnation_count
  if(n<=0)return planForLevel(0)
  const start=Math.min(6,Math.max(1,n)) as 1|2|3|4|5|6
  if(start>=2){const hazard=recoveryModelHazard(m),escalation:RecoveryPlan={level:3,action:'model-escalation',prompt:`One bounded same-model correction returned the same normalized failure without semantic gain. Switch this SAME task to one fresh recovery-only model candidate (${hazard.recovery_candidates.join(', ')}) while preserving current files and canonical evidence; do not restart top-level planning.`};if(hazard.open&&recoveryStrategyEligibility(m,escalation).allowed)return escalation}
  for(let level=start;level<=5;level++){
    const plan=planForLevel(level as 1|2|3|4|5)
    if(recoveryStrategyEligibility(m,plan).allowed)return plan
  }
  return planForLevel(6)
}
