import { type SkillPermission } from './permissions.js';
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
export type SkillPreflightOutcome = 'allow' | 'ask' | 'deny' | 'disabled' | 'missing' | 'invalid';
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
export declare function resolveSkillPlan(capabilities: string[], candidates: SkillCandidate[], permissionMap?: Record<string, SkillPermission>, skillToolEnabled?: boolean, role?: string): SkillPlan;
export declare function selectSkills(capabilities: string[], candidates: SkillCandidate[]): SkillCandidate[];
export type SkillResourceKind = 'references' | 'scripts' | 'assets' | 'examples';
export interface SkillResource {
    name: string;
    kind: SkillResourceKind;
    relativePath: string;
    absolutePath: string;
}
export declare function indexSkillResources(skill: SkillCandidate): SkillResource[];
export declare function readSkillResource(skill: SkillCandidate, kind: SkillResourceKind, relativePath: string): string;
