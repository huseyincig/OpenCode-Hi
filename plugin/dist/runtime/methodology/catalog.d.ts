import { type HiMethodologyExitRequirement, type HiMethodologySignalName, type HiMethodologyTriggerSource } from '../../generated/methodology-policy.js';
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
export declare function builtinMethodologyCatalog(): HiMethodologyCatalogEntry[];
export declare function methodologyCatalog(projectRoot?: string): HiMethodologyCatalogEntry[];
export declare function methodologyCatalogEntry(name: string, projectRoot?: string): HiMethodologyCatalogEntry | undefined;
export declare const methodologyLimits: {
    readonly defaultActive: 0;
    readonly typicalMax: 1;
    readonly hardMax: 3;
};
export declare function methodologiesForSignal(signal: HiMethodologySignalName, projectRoot?: string): HiMethodologyCatalogEntry[];
