import type {MissionState} from '../mission/types.js'
import {buildMissionRuntimeProjection} from '../context/mission-runtime-projection.js'
import {projectControlDecision} from '../completion/control-projection.js'

export interface AutonomousMissionUxView{
  mission_id:string
  status:string
  objective:string
  action:'WAIT'|'VERIFY'|'RECONCILE'|'USER_ACTION_REQUIRED'|'CONTINUE'|'DONE'
  completion_ready:boolean
  next_action:string
  blockers:string[]
  open_obligations:Array<{id:string;kind:string}>
  active_work:string
  verification:string
  authority:string
  user_controls:{settings_owner:'hi_settings';decision_owner:'HumanDecisionContract';completion_owner:'MissionStore/evaluateCompletion'}
  claim_boundary:'derived-from-canonical-runtime'
}

/** Bounded user-facing mission projection. It owns no lifecycle or UI cache state. */
export function autonomousMissionUxView(mission:MissionState,projectRoot?:string):AutonomousMissionUxView{
  const runtime=buildMissionRuntimeProjection(mission,undefined,projectRoot),control=projectControlDecision(mission,projectRoot)
  return{
    mission_id:mission.identity.mission_id,status:mission.identity.status,objective:runtime.objective,
    action:control.action,completion_ready:control.completion_ready,next_action:runtime.next_action,
    blockers:[...runtime.blockers],open_obligations:control.open_obligations.map(item=>({...item})),
    active_work:runtime.task_worker,verification:runtime.verification,authority:runtime.authority,
    user_controls:{settings_owner:'hi_settings',decision_owner:'HumanDecisionContract',completion_owner:'MissionStore/evaluateCompletion'},
    claim_boundary:'derived-from-canonical-runtime',
  }
}
