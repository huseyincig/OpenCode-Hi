import type { MissionState } from '../mission/types.js';
export interface AutonomousMissionUxView {
    mission_id: string;
    status: string;
    objective: string;
    action: 'WAIT' | 'VERIFY' | 'RECONCILE' | 'USER_ACTION_REQUIRED' | 'CONTINUE' | 'DONE';
    completion_ready: boolean;
    next_action: string;
    blockers: string[];
    open_obligations: Array<{
        id: string;
        kind: string;
    }>;
    active_work: string;
    verification: string;
    authority: string;
    user_controls: {
        settings_owner: 'hi_settings';
        decision_owner: 'HumanDecisionContract';
        completion_owner: 'MissionStore/evaluateCompletion';
    };
    claim_boundary: 'derived-from-canonical-runtime';
}
/** Bounded user-facing mission projection. It owns no lifecycle or UI cache state. */
export declare function autonomousMissionUxView(mission: MissionState, projectRoot?: string): AutonomousMissionUxView;
/**
 * Default human-facing status. The first line intentionally preserves the
 * compact compatibility surface while the following lines reuse canonical
 * derived projections instead of inventing another status owner/store.
 */
export declare function formatAutonomousMissionStatus(mission: MissionState, projectRoot?: string): string;
