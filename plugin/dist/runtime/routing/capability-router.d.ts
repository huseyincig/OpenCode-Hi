import type { Category, NormalizedMissionIntent } from '../mission/types.js';
export interface CapabilityDecision {
    role: string;
    category: Category;
    capabilities: string[];
    reason: string[];
}
export interface ProfileSettingsLite {
    specialistThreshold: 'low' | 'medium' | 'high';
    reviewThreshold: 'low' | 'medium' | 'high';
}
/**
 * Canonical child ownership is semantic/capability-derived. Execution category/profile
 * can tune effort, but may not substitute another child role for the semantic owner.
 */
export declare function routeCapabilities(intent: NormalizedMissionIntent, _profile?: ProfileSettingsLite): CapabilityDecision;
