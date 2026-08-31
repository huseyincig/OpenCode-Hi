import type {MissionState} from '../mission/types.js'
import {buildMissionRuntimeProjection} from '../context/mission-runtime-projection.js'
import {projectControlDecision} from '../completion/control-projection.js'
import {formatUserMissionStatus} from '../ledger/status.js'

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

function boundedLine(value:string,max=360):string{
  const compact=String(value??'').replace(/\s+/g,' ').trim()
  return compact.length<=max?compact:`${compact.slice(0,Math.max(0,max-1))}…`
}

/**
 * Default human-facing status. The first line intentionally preserves the
 * compact compatibility surface while the following lines reuse canonical
 * derived projections instead of inventing another status owner/store.
 */
export function formatAutonomousMissionStatus(mission:MissionState,projectRoot?:string):string{
  const view=autonomousMissionUxView(mission,projectRoot),legacy=formatUserMissionStatus(mission),blockers=view.blockers.slice(0,3).map(x=>boundedLine(x,240))
  return[
    legacy,
    `Goal: ${boundedLine(view.objective,420)}`,
    `Now: ${boundedLine(view.active_work,420)}`,
    `Control: ${view.action} · ${boundedLine(view.next_action,420)}`,
    `Verification: ${boundedLine(view.verification,360)}`,
    `Authority: ${boundedLine(view.authority,320)}`,
    `Blockers: ${blockers.length?blockers.join(' | '):'none'}`,
  ].join('\n')
}
