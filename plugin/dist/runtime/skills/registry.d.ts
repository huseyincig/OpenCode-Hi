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
export declare function configuredSkillPaths(hostConfig: Record<string, unknown>): string[];
export declare function discoverSkills(projectRoot: string, hiRoot?: string, extraPaths?: string[]): SkillCandidate[];
export declare function resolveSkillPlan(methodologyNeeds: string[], candidates: SkillCandidate[], permissionMap?: Record<string, SkillPermission>, skillToolEnabled?: boolean, role?: string, catalog?: HiMethodologyCatalogEntry[], availableResources?: ReadonlySet<string>): SkillPlan;
export declare function selectMethodologies(methodologyNeeds: string[], candidates: SkillCandidate[], role?: string, catalog?: HiMethodologyCatalogEntry[]): SkillCandidate[];
export type SkillResourceKind = 'references' | 'scripts' | 'assets' | 'examples';
export interface SkillResource {
    name: string;
    kind: SkillResourceKind;
    relativePath: string;
    absolutePath: string;
}
export declare function indexSkillResources(skill: SkillCandidate): SkillResource[];
export declare function readSkillResource(skill: SkillCandidate, kind: SkillResourceKind, relativePath: string): string;
