import type { MissionState } from '../mission/types.js';
export interface CollaborationParticipantView {
    participant_id: string;
    kind: 'primary-session' | 'child-worker';
    mission_id: string;
    session_id?: string;
    task_id?: string;
    role?: string;
    status: string;
}
export interface CollaborationView {
    participants: CollaborationParticipantView[];
    coordination: {
        peer_units: number;
        running_allocations: number;
        active_writers: number;
    };
    open_human_decision?: {
        decision_id: string;
        semantic_type: string;
        blocking_scope: {
            mission_id: string;
            task_id?: string;
            worker_id?: string;
        };
        authority_ref?: string;
    };
    context_artifacts: Array<{
        id: string;
        kind: string;
        uri?: string;
        sha256?: string;
    }>;
    authority: 'canonical-owners-only';
    claim_boundary: 'projection-only';
}
/**
 * Side-effect-free collaboration projection over canonical runtime owners.
 *
 * It deliberately does not persist participants, approvals, task state, context,
 * or remote acknowledgements. Any future external collaborator transport must
 * enter through the owning Mission/HumanDecision/Authority/Context/Evidence seam.
 */
export declare function collaborationView(current: MissionState, projectMissions?: readonly MissionState[]): CollaborationView;
