import type { Category } from '../mission/types.js';
import type { HiConfig } from '../../config/schema.js';
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
        failure_penalty: number;
        success_credit: number;
    }>;
}
export interface MissionModelFeedback {
    failures?: Record<string, number>;
    successes?: Record<string, number>;
    retries?: Record<string, number>;
}
export interface RuntimeModelCandidateStatus {
    ok: boolean;
    reason?: string;
}
export declare function runtimeModelCandidateStatus(id: string, availableInput: AvailableModel[], config: HiConfig, hostConfig?: Record<string, unknown>): RuntimeModelCandidateStatus;
export declare function resolveModel(category: Category, availableInput: AvailableModel[], config: HiConfig, explicit?: string, role?: string, hostConfig?: Record<string, unknown>, feedback?: MissionModelFeedback): ModelResolution;
