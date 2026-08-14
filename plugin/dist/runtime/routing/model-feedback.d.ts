import type { Category, MissionState } from '../mission/types.js';
import type { MissionModelFeedback } from './model-resolver.js';
export type ModelFeedbackConfidence = 'insufficient' | 'low' | 'medium' | 'high';
export type ModelVerificationOutcome = 'passed' | 'failed' | 'not-observed';
export interface ModelFeedbackObservation {
    model: string;
    role: string;
    category: Category;
    success: boolean;
    retry_count: number;
    verification_outcome: ModelVerificationOutcome;
    latency_ms?: number;
    observed_at: number;
}
export declare function missionModelFeedbackObservations(m: MissionState, role?: string, category?: Category, window?: number): ModelFeedbackObservation[];
export declare function deriveMissionModelFeedback(m: MissionState, role?: string, category?: Category, window?: number): MissionModelFeedback;
