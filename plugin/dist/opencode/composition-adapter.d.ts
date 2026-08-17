import { type HiAgentProjectionResult } from './agent-binding.js';
import { type ProjectAuthorityStore } from '../runtime/safety/project-authority.js';
import { type PrimaryToolVisibilityProjectionResult } from './primary-tool-visibility.js';
export interface OpenCodeCompositionCapabilities {
    v1ConfigHook: boolean;
    v2AgentTransform: boolean;
    v2SkillRegistration: boolean;
    v2PermissionTransform: boolean;
}
export type OpenCodeCompositionMode = 'v1-config-hook' | 'v2-domain-transform' | 'unsupported';
export declare function selectOpenCodeCompositionMode(capabilities: OpenCodeCompositionCapabilities): OpenCodeCompositionMode;
export type OpenCodeConfigFamily = 'v1-config-hook' | 'v2-domain-config' | 'mixed' | 'unknown';
export interface OpenCodeCompositionProbe {
    family: OpenCodeConfigFamily;
    signals: string[];
    v1ConfigProjection: boolean;
    v2DomainTransformPreferred: boolean;
}
export declare function probeOpenCodeComposition(config: Record<string, unknown>): OpenCodeCompositionProbe;
export interface V1CompositionProjectionResult {
    agentProjection: HiAgentProjectionResult;
    primaryToolVisibility: PrimaryToolVisibilityProjectionResult;
    skillPathAdded: boolean;
    methodologyPermissions: number;
    diagnostics: string[];
}
/** Current SDK/V1 compatibility projection. Mutates only explicit Hi-owned/narrowing leaves. */
export declare function projectHiV1Composition(input: {
    config: Record<string, unknown>;
    packagedAgents: Record<string, unknown>;
    packagedSkillsDir: string;
    projectRoot: string;
    projectAuthority: ProjectAuthorityStore;
}): V1CompositionProjectionResult;
export interface OpenCodeCompositionProjectionResult {
    applied: boolean;
    mode: 'v1-config-hook' | 'v2-domain-transform-required' | 'mixed-config-collision';
    probe: OpenCodeCompositionProbe;
    v1?: V1CompositionProjectionResult;
    diagnostics: string[];
}
/**
 * Adapter entrypoint used by the current config hook. V2-shaped config is never
 * backfilled with V1 keys; that host family requires the V2 domain transform/
 * registration adapter instead of pretending the old config mutation seam is portable.
 */
export declare function projectHiOpenCodeComposition(input: {
    config: Record<string, unknown>;
    packagedAgents: Record<string, unknown>;
    packagedSkillsDir: string;
    projectRoot: string;
    projectAuthority: ProjectAuthorityStore;
}): OpenCodeCompositionProjectionResult;
