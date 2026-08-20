import type { Category } from '../mission/types.js';
import type { HiConfig } from '../../config/schema.js';
import { type ModelRoutedChildRole } from '../../config/schema.js';
import type { ModelCapabilityProfile } from '../../contracts/model.js';
export type AvailableModel = ModelCapabilityProfile;
export interface ModelFallbackReason {
    model: string;
    variant?: string;
    reason: string;
}
export interface ModelResolution {
    primary?: string;
    primaryVariant?: string;
    fallbacks: string[];
    fallbackVariants: Record<string, string | undefined>;
    reason: string[];
    fallbackReasons: ModelFallbackReason[];
    rejected: Array<{
        id: string;
        reason: string;
    }>;
    scores?: Array<{
        model: string;
        score: number;
        expected_completion_cost: number;
        expected_completion_cost_basis: 'heuristic';
        failure_penalty: number;
        success_credit: number;
        verification_adjustment: number;
        feedback_confidence: string;
        observed_latency_ms?: number;
    }>;
}
export interface MissionModelFeedback {
    failures?: Record<string, number>;
    successes?: Record<string, number>;
    retries?: Record<string, number>;
    samples?: Record<string, number>;
    confidence?: Record<string, 'insufficient' | 'low' | 'medium' | 'high'>;
    average_latency_ms?: Record<string, number>;
    verification_passes?: Record<string, number>;
    verification_failures?: Record<string, number>;
    window_size?: number;
}
export interface RuntimeModelCandidateStatus {
    ok: boolean;
    reason?: string;
}
export declare function runtimeModelCandidateStatus(id: string, availableInput: AvailableModel[], config: HiConfig, hostConfig?: Record<string, unknown>, role?: string): RuntimeModelCandidateStatus;
export declare function resolveModel(category: Category, availableInput: AvailableModel[], config: HiConfig, explicit?: string, role?: string, hostConfig?: Record<string, unknown>, feedback?: MissionModelFeedback): ModelResolution;
export declare function recommendInitialRoleModels(available: AvailableModel[], config: HiConfig, hostConfig?: Record<string, unknown>): Partial<Record<ModelRoutedChildRole, string[]>>;
