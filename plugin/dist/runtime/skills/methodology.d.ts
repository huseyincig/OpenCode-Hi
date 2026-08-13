import type { MethodologyProvenance } from '../mission/types.js';
import type { SkillCandidate } from './registry.js';
export declare function methodologyProvenance(candidates: SkillCandidate[]): MethodologyProvenance[];
export declare function ownershipContract(kind: 'parent' | 'child', methodologies?: string[]): string;
