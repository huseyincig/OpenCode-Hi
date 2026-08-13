import { type HiMethodologyExitRequirement, type HiMethodologyName, type HiMethodologySignalName, type HiMethodologyTriggerSource } from '../../generated/methodology-policy.js';
export type HiMethodologyProvider = 'hi' | 'project';
export interface HiMethodologyCatalogEntry {
    name: string;
    provider: HiMethodologyProvider;
    preferredRoles: string[];
    compatibleRoles: string[];
    activationSignals: HiMethodologySignalName[];
    triggerSources: HiMethodologyTriggerSource[];
    priority: 'low' | 'normal' | 'high';
    contextCost: 'low' | 'medium' | 'high';
    executionCost: 'low' | 'medium' | 'high';
    exitRequirements: HiMethodologyExitRequirement[];
    weight: number;
    compositionCost: 'low' | 'medium' | 'high';
    usefulCoexistence: string[];
    conflicts: string[];
    resourceRequirements: string[];
}
export declare function isBuiltinHiMethodologyName(value: string): value is HiMethodologyName;
export declare function builtinMethodologyCatalog(): HiMethodologyCatalogEntry[];
export declare function methodologyCatalog(projectRoot?: string): HiMethodologyCatalogEntry[];
export declare function methodologyCatalogEntry(name: string, projectRoot?: string): HiMethodologyCatalogEntry | undefined;
export declare const methodologyLimits: {
    readonly defaultActive: 0;
    readonly typicalMax: 1;
    readonly hardMax: 3;
};
export declare function methodologySignalSpec(signal: HiMethodologySignalName): {
    readonly producers: readonly ["architecture"];
    readonly trigger_source: "contract-ambiguity";
} | {
    readonly producers: readonly ["architecture"];
    readonly trigger_source: "dependency-structure";
} | {
    readonly producers: readonly ["context"];
    readonly trigger_source: "context-gap";
} | {
    readonly producers: readonly ["context"];
    readonly trigger_source: "context-gap";
} | {
    readonly producers: readonly ["runtime-failure"];
    readonly trigger_source: "failure-signal";
} | {
    readonly producers: readonly ["runtime-failure"];
    readonly trigger_source: "failure-signal";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "task-intent";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "task-intent";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "task-intent";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "task-intent";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "design-decision";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "task-intent";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "failure-signal";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "task-intent";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "task-intent";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "failure-signal";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "task-intent";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "task-intent";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "task-intent";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "external-source-need";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "task-intent";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "performance-signal";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "dependency-structure";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "task-intent";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "task-intent";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "release-boundary";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "human-feedback";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "task-intent";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "task-intent";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "task-intent";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "verification-need";
} | {
    readonly producers: readonly ["intent"];
    readonly trigger_source: "task-intent";
} | {
    readonly producers: readonly ["project-intelligence"];
    readonly trigger_source: "project-learning";
} | {
    readonly producers: readonly ["release"];
    readonly trigger_source: "release-boundary";
} | {
    readonly producers: readonly ["risk"];
    readonly trigger_source: "risk-escalation";
} | {
    readonly producers: readonly ["changed-surface"];
    readonly trigger_source: "changed-surface";
} | {
    readonly producers: readonly ["changed-surface"];
    readonly trigger_source: "changed-surface";
} | {
    readonly producers: readonly ["changed-surface"];
    readonly trigger_source: "changed-surface";
} | {
    readonly producers: readonly ["changed-surface"];
    readonly trigger_source: "changed-surface";
} | {
    readonly producers: readonly ["changed-surface"];
    readonly trigger_source: "changed-surface";
} | {
    readonly producers: readonly ["changed-surface"];
    readonly trigger_source: "changed-surface";
} | {
    readonly producers: readonly ["verification"];
    readonly trigger_source: "verification-need";
} | {
    readonly producers: readonly ["verification"];
    readonly trigger_source: "verification-need";
} | {
    readonly producers: readonly ["verification"];
    readonly trigger_source: "verification-need";
} | {
    readonly producers: readonly ["verification"];
    readonly trigger_source: "verification-need";
};
export declare function methodologiesForSignal(signal: HiMethodologySignalName, projectRoot?: string): HiMethodologyCatalogEntry[];
