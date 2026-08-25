export declare const HI_CONFIG_SCHEMA: 2;
export type ExecutionPolicyMode = 'minimal' | 'balanced' | 'thorough' | 'adaptive' | 'manual';
export type PrimaryModePolicy = 'auto' | 'working-manager' | 'manager';
export type CategoryName = 'quick' | 'standard' | 'deep' | 'visual' | 'critical';
export type CompatibilityMode = 'compatible' | 'strict';
export type TopologyMode = 'adaptive' | 'single-agent' | 'multi-agent';
export declare const MODEL_ROUTED_CHILD_ROLES: readonly ["coder", "architect", "repository-explorer", "researcher", "technical-writer", "test-engineer", "qa-reviewer", "security-reviewer", "visual-qa"];
export type ModelRoutedChildRole = typeof MODEL_ROUTED_CHILD_ROLES[number];
export declare function isModelRoutedChildRole(value: unknown): value is ModelRoutedChildRole;
export interface ProfileSettings {
    specialistThreshold: 'low' | 'medium' | 'high';
    reviewThreshold: 'low' | 'medium' | 'high';
}
export interface HiConfig {
    schemaVersion: typeof HI_CONFIG_SCHEMA;
    executionPolicy: ExecutionPolicyMode;
    primaryMode: PrimaryModePolicy;
    compatibility: {
        mode: CompatibilityMode;
        validatedOpenCodeVersions?: string[];
    };
    routing: {
        categoryVariants: Partial<Record<CategoryName, string[]>>;
        roleModels: Record<string, string[]>;
        roleVariants: Record<string, Record<string, string>>;
        maxFallbacks: number;
        allowedModels: string[];
        allowedProviders: string[];
        deniedModels: string[];
    };
    execution: {
        topology: TopologyMode;
        maxAgents: number;
        parallelism: number;
    };
    parallel: {
        enabled: boolean;
        max: number;
        providers: Record<string, number>;
        models: Record<string, number>;
    };
    profile: {
        minimal: ProfileSettings;
        balanced: ProfileSettings;
        thorough: ProfileSettings;
    };
}
export interface ConfigResolutionReport {
    schema: typeof HI_CONFIG_SCHEMA;
    canonical: boolean;
    notes: string[];
}
export declare function isRecord(value: unknown): value is Record<string, unknown>;
