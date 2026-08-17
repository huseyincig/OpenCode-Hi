import { type SkillPermission } from './permissions.js';
import { type HiMethodologyCatalogEntry } from '../methodology/catalog.js';
export type SkillProvider = 'project' | 'personal' | 'hi';
export interface SkillCandidate {
    name: string;
    provider: SkillProvider;
    path: string;
    valid: boolean;
    enabled: boolean;
    orchestrationRisk: boolean;
    permission?: SkillPermission;
    canonicalForMethodology?: boolean;
}
export type SkillPreflightOutcome = 'allow' | 'ask' | 'deny' | 'disabled' | 'missing' | 'invalid' | 'incompatible' | 'resource-unavailable' | 'unknown-policy' | 'budget-exceeded' | 'composition-deferred';
export interface SkillPreflightResult {
    name: string;
    outcome: SkillPreflightOutcome;
    provider?: SkillProvider;
    path?: string;
}
export interface SkillPlan {
    selected: SkillCandidate[];
    requested: string[];
    missing: string[];
    outcomes: SkillPreflightResult[];
    reason: string[];
}
/**
 * Narrow native-skill compatibility probe. It does not inventory or load the skill catalog.
 * Only methodology names already selected by Hi policy are checked for canonical availability
 * and same-name shadows across the OpenCode discovery roots. OpenCode owns actual discovery,
 * permission enforcement, body loading and bundled resource access.
 */
export declare function methodologySkillCandidates(requestedNames: string[], projectRoot: string, hiRoot: string, hostConfig: Record<string, unknown>, catalog?: HiMethodologyCatalogEntry[]): SkillCandidate[];
export declare function resolveSkillPlan(methodologyNeeds: string[], candidates: SkillCandidate[], permissionMap?: Record<string, SkillPermission>, skillToolEnabled?: boolean, role?: string, catalog?: HiMethodologyCatalogEntry[], availableResources?: ReadonlySet<string>): SkillPlan;
