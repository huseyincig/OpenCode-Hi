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
    recoveryCandidates: string[];
    fallbackVariants: Record<string, string | undefined>;
    reason: string[];
    fallbackReasons: ModelFallbackReason[];
    rejected: Array<{
        id: string;
        reason: string;
    }>;
}
/** Telemetry shape retained for compatibility; it is not routing authority in the 0.2.4 resolver. */
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
export interface AutomaticRecoveryAuthority {
    requested_model?: string;
    model_selection_reason?: string[];
    recovery_candidates?: string[];
}
export declare function automaticRecoveryCandidates(state: AutomaticRecoveryAuthority): string[];
export declare function runtimeModelCandidateStatus(id: string, availableInput: AvailableModel[], config: HiConfig, hostConfig?: Record<string, unknown>, role?: string): RuntimeModelCandidateStatus;
export declare function resolveModel(category: Category, availableInput: AvailableModel[], config: HiConfig, explicit?: string, role?: string, hostConfig?: Record<string, unknown>, _feedback?: MissionModelFeedback): ModelResolution;
/** Pure preview only. Runtime inventory refresh must never persist these inferred choices. */
export declare function recommendInitialRoleModels(available: AvailableModel[], config: HiConfig, hostConfig?: Record<string, unknown>): Partial<Record<ModelRoutedChildRole, string[]>>;
