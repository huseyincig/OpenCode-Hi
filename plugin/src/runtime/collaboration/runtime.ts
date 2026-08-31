import type {MissionState} from '../mission/types.js'
import {projectSchedulingPeerView} from '../scheduler/project-peer-view.js'

export interface CollaborationParticipantView{
  participant_id:string
  kind:'primary-session'|'child-worker'
  mission_id:string
  session_id?:string
  task_id?:string
  role?:string
  status:string
}

export interface CollaborationView{
  participants:CollaborationParticipantView[]
  coordination:{peer_units:number;running_allocations:number;active_writers:number}
  open_human_decision?:{decision_id:string;semantic_type:string;blocking_scope:{mission_id:string;task_id?:string;worker_id?:string};authority_ref?:string}
  context_artifacts:Array<{id:string;kind:string;uri?:string;sha256?:string}>
  authority:'canonical-owners-only'
  claim_boundary:'projection-only'
}

/**
 * Side-effect-free collaboration projection over canonical runtime owners.
 *
 * It deliberately does not persist participants, approvals, task state, context,
 * or remote acknowledgements. Any future external collaborator transport must
 * enter through the owning Mission/HumanDecision/Authority/Context/Evidence seam.
 */
export function collaborationView(current:MissionState,projectMissions:readonly MissionState[]=[]):CollaborationView{
  const peers=projectSchedulingPeerView(current,projectMissions),participants:CollaborationParticipantView[]=[{
    participant_id:`session:${current.identity.session_id}`,
    kind:'primary-session',mission_id:current.identity.mission_id,session_id:current.identity.session_id,status:current.identity.status,
  }]
  for(const worker of current.execution.workers)participants.push({participant_id:`worker:${worker.id}`,kind:'child-worker',mission_id:current.identity.mission_id,...(worker.session_id?{session_id:worker.session_id}:{}),task_id:worker.task_id,role:worker.role,status:worker.status})
  const decision=current.authority.human_decision
  return{
    participants,
    coordination:{peer_units:peers.peerUnits.length,running_allocations:peers.running.length,active_writers:peers.activeWriters.length},
    ...(decision?.status==='OPEN'?{open_human_decision:{decision_id:decision.decision_id,semantic_type:decision.semantic_type,blocking_scope:{...decision.blocking_scope},...(decision.authority_ref?{authority_ref:decision.authority_ref}:{})}}:{}),
    context_artifacts:current.context.context_artifacts.map(item=>({id:item.id,kind:item.kind,...(item.uri?{uri:item.uri}:{}),...(item.sha256?{sha256:item.sha256}:{})})),
    authority:'canonical-owners-only',claim_boundary:'projection-only',
  }
}
