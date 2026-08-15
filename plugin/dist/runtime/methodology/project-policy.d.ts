import { type HiMethodologyExitRequirement, type HiMethodologySignalName } from '../../generated/methodology-policy.js';
export interface ProjectMethodologyPolicy {
    schema: 1;
    type: 'hi-project-methodology';
    name: string;
    enabled: boolean;
    purpose: string;
    trigger: string;
    do_not_trigger: string;
    exit_condition: string;
    preferred_roles: string[];
    compatible_roles: string[];
    activation_signals: HiMethodologySignalName[];
    exit_requirements: HiMethodologyExitRequirement[];
    priority: 'low' | 'normal' | 'high';
    context_cost: 'low' | 'medium' | 'high';
    execution_cost: 'low' | 'medium' | 'high';
    weight: number;
    composition_cost: 'low' | 'medium' | 'high';
    useful_coexistence: string[];
    conflicts: string[];
    resource_requirements: string[];
    admission: 'manual' | 'project-intelligence';
}
export declare function projectMethodologyPolicyDir(projectRoot: string): string;
export declare function discoverProjectMethodologyPolicies(projectRoot: string): ProjectMethodologyPolicy[];
