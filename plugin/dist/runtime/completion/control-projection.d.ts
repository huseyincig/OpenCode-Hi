import type { MissionState } from '../mission/types.js';
export type ControlDecisionAction = 'WAIT' | 'VERIFY' | 'RECONCILE' | 'USER_ACTION_REQUIRED' | 'CONTINUE' | 'DONE';
export interface ControlDecisionProjection {
    action: ControlDecisionAction;
    completion_ready: boolean;
    wait_for: string[];
    missing_evidence: Array<{
        obligation_id: string;
        kind: string;
        result: string;
    }>;
    open_obligations: Array<{
        id: string;
        kind: string;
    }>;
    ineffective_actions: string[];
    verification_route_status: 'available' | 'none' | 'unknown';
    verification_routes: Array<{
        required_kind: string;
        evidence_kind: string;
        command: string;
        source: string;
    }>;
}
/**
 * Pure/read-time control projection over canonical Mission/Evidence/Authority owners.
 * It never persists lifecycle state or invents a second planner. Its purpose is to
 * prevent consumers from rediscovering a decision that Hi already knows.
 */
export declare function projectControlDecision(m: MissionState, projectRoot?: string): ControlDecisionProjection;
