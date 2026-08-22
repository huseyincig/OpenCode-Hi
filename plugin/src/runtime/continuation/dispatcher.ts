import type { HostPort } from '../host/port.js'
import type { MissionState } from '../mission/types.js'
import { appendLedger } from '../ledger/ledger.js'
import { recordRecoveryStrategy } from './recovery-governor.js'
export async function dispatchContinuation(host:Pick<HostPort,'continueSession'|'sessionStatus'>,mission:MissionState,prompt:string,reason:string):Promise<boolean>{
  const now=Date.now(),generation=mission.continuation.generation;if(mission.continuation.user_interrupted||mission.identity.status==='stopped'){appendLedger(mission,'continuation.rejected',{payload:{reason:'user-interrupted',generation}});return false}
  if(mission.continuation.continuation_active||mission.continuation.active_action_id||(mission.continuation.suppress_until??0)>now||(mission.continuation.continuation_lock_until??0)>now)return false
  const previous={lock:mission.continuation.continuation_lock_until,suppress:mission.continuation.suppress_until,lastAt:mission.continuation.last_continuation_at,reason:mission.continuation.continuation_reason,lastAction:mission.continuation.last_action_id}
  const iteration=mission.continuation.iteration+1,actionID=`continue:${mission.identity.mission_id}:${generation}:${iteration}:${now.toString(36)}`
  mission.continuation.continuation_active=true;mission.continuation.active_action_id=actionID;mission.continuation.continuation_lock_until=now+2500;mission.continuation.suppress_until=now+400;mission.continuation.last_continuation_at=now;mission.continuation.iteration=iteration;mission.continuation.continuation_reason=reason;mission.continuation.last_action_id=actionID;appendLedger(mission,'continuation',{payload:{reason,iteration,generation,action_id:actionID}})
  try{
    const parentStatus=await host.sessionStatus(mission.identity.session_id)
    if(parentStatus!=='idle'){
      mission.continuation.iteration=Math.max(0,mission.continuation.iteration-1);mission.continuation.continuation_lock_until=previous.lock;mission.continuation.suppress_until=previous.suppress;mission.continuation.last_continuation_at=previous.lastAt;mission.continuation.continuation_reason=previous.reason;mission.continuation.last_action_id=previous.lastAction
      appendLedger(mission,'continuation.deferred',{payload:{reason:parentStatus==='busy'||parentStatus==='retry'?'parent-session-active':'parent-session-status-unverified',host_status:parentStatus,generation,action_id:actionID}});return false
    }
    const sent=await host.continueSession(mission.identity.session_id,prompt,{hiInternalContinuation:true,reason,generation,actionID});if(!sent){appendLedger(mission,'continuation.unavailable',{payload:{reason:'host-continuation-api-missing'}});return false}
    if(mission.continuation.generation!==generation){appendLedger(mission,'continuation.stale-completion',{payload:{started_generation:generation,current_generation:mission.continuation.generation,action_id:actionID}});return false}
    if(mission.continuation.active_action_id!==actionID){appendLedger(mission,'continuation.stale-action-completion',{payload:{action_id:actionID,current_action_id:mission.continuation.active_action_id??null,generation}});return false}
    mission.continuation.continuation_failure_count=0;mission.continuation.last_continuation_failure_at=undefined;const recovery=/^stagnation-level-(\d+):(same-worker-resume|model-escalation|narrow-task|alternate-plan|fresh-worker)$/.exec(reason);if(recovery){const level=Number(recovery[1]);if(level>=1&&level<=5)recordRecoveryStrategy(mission,{level:level as 1|2|3|4|5,action:recovery[2] as 'same-worker-resume'|'model-escalation'|'narrow-task'|'alternate-plan'|'fresh-worker'},'started',now)}return true
  }catch(error){if(mission.continuation.generation===generation&&mission.continuation.active_action_id===actionID){mission.continuation.continuation_failure_count=(mission.continuation.continuation_failure_count??0)+1;mission.continuation.last_continuation_failure_at=Date.now();if(mission.continuation.iteration===iteration)mission.continuation.iteration=Math.max(0,mission.continuation.iteration-1)}appendLedger(mission,'continuation.failed',{payload:{error:String(error),generation,action_id:actionID,runtime_failures:mission.continuation.continuation_failure_count??0}});return false}
  finally{if(mission.continuation.generation===generation&&mission.continuation.active_action_id===actionID){mission.continuation.continuation_active=false;mission.continuation.active_action_id=undefined}}
}
