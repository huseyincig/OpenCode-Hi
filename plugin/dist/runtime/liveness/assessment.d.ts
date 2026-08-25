import type { MissionState } from '../mission/types.js';
export declare const DEFAULT_NO_PROGRESS_WINDOW_MS = 120000;
export type VerifiedInflight = 'YES' | 'NO' | 'UNKNOWN';
export type LivenessState = 'ACTIVE' | 'STALLED' | 'RECONCILE' | 'TERMINAL';
export type ExactExecutionState = 'ACTIVE' | 'UNKNOWN' | 'QUIESCENT' | 'VERIFIED_ABORTED';
export interface ProcessLivenessObservation {
    pid_alive?: boolean;
    owner_verified: boolean;
    status: 'running' | 'exited' | 'unknown';
}
export interface MissionLivenessObservation {
    now?: number;
    noProgressWindowMs?: number;
    hostSessions?: Record<string, 'idle' | 'busy' | 'retry' | 'unknown'>;
    processes?: Record<string, ProcessLivenessObservation>;
}
export interface MissionLivenessAssessment {
    state: LivenessState;
    inflight: VerifiedInflight;
    last_durable_progress_at: number;
    no_progress_ms: number;
    no_progress_window_ms: number;
    destructive_recovery_allowed: boolean;
    reasons: string[];
}
export interface ToolOperationIdentity {
    operation_id: string;
    session_id: string;
    tool: string;
    generation: number;
}
export declare function lastDurableProgressAt(m: MissionState): number;
export declare function assessMissionLiveness(m: MissionState, observation?: MissionLivenessObservation): MissionLivenessAssessment;
export declare function recordToolOperationProgress(m: MissionState, identity: ToolOperationIdentity, phase: 'started' | 'result', at?: number): boolean;
export declare function recordAssistantProgress(m: MissionState, input: {
    worker_id: string;
    task_id: string;
    session_id: string;
    generation: number;
    message_id?: string;
    observed_at: number;
    output_tokens: number;
    reasoning_tokens: number;
    tool_calls: number;
    text_chars: number;
}): boolean;
export declare function replacementExecutionAdmission(state: ExactExecutionState): boolean;
