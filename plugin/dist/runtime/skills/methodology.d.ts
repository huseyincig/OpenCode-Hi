import type { MethodologyProvenance } from '../mission/types.js';
import type { SkillCandidate } from './registry.js';
export declare function methodologyProvenance(skills: SkillCandidate[]): MethodologyProvenance[];
export declare function buildMethodologyBundle(skills: SkillCandidate[]): {
    text: string;
    loaded: string[];
    truncated: string[];
};
export declare function ownershipContract(kind: 'parent' | 'child', skills?: string[]): string;
