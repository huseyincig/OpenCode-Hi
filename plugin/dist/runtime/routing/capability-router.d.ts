import type { Category, NormalizedMissionIntent } from '../mission/types.js';
export interface CapabilityDecision {
    role: string;
    category: Category;
    capabilities: string[];
    reason: string[];
}
export type AutonomyProfile = 'basic' | 'standard' | 'powerful' | 'smart';
export interface ProfileSettingsLite {
    specialistThreshold: 'low' | 'medium' | 'high';
    reviewThreshold: 'low' | 'medium' | 'high';
}
export declare function routeCapabilities(intent: NormalizedMissionIntent, profile?: ProfileSettingsLite): CapabilityDecision;
