import type { MissionState } from '../mission/types.js';
export interface MissionMetrics {
    completed: boolean;
    duration_ms: number;
    agents_spawned: number;
    tasks_created: number;
    zero_methodology_workers: number;
    methodologies_loaded_total: number;
    average_methodologies_per_worker: number;
    handoff_events: number;
    average_handoff_chars: number;
    max_handoff_chars: number;
    same_session_resumes: number;
    team_mode_used: boolean;
    duplicate_work_events: number;
    user_interruptions: number;
    premature_stop_blocks: number;
    stale_verification_blocks: number;
    continuation_recovery_events: number;
    continuation_recovery_success: number;
    evidence_items: number;
    failed_workers: number;
}
export declare function missionMetrics(m: MissionState): MissionMetrics;
export declare function aggregateMissionMetrics(missions: MissionState[]): Record<string, unknown>;
