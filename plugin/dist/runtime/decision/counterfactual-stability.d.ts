import type { NormalizedMissionIntent, VerificationPolicy } from '../mission/types.js';
import { type TopologyPolicyConfig } from '../execution/topology-policy.js';
export type DecisionStabilityAxis = 'execution-path' | 'topology' | 'team' | 'model-class';
export type DecisionPerturbationDimension = 'risk' | 'ambiguity' | 'scope' | 'dependency-class';
export interface CounterfactualDecisionStability {
    advisory_only: true;
    probability_claim: false;
    sample_count: number;
    unchanged_count: number;
    stability_ratio: number;
    band: 'ROBUST' | 'MIXED' | 'FRAGILE';
    fragile_dimensions: DecisionPerturbationDimension[];
    changed_axes: Record<DecisionStabilityAxis, number>;
    samples: Array<{
        dimension: DecisionPerturbationDimension;
        from: string;
        to: string;
        changed_axes: DecisionStabilityAxis[];
    }>;
}
export declare function counterfactualDecisionStability(input: {
    intent: NormalizedMissionIntent;
    verification: VerificationPolicy;
    primaryMode?: 'auto' | 'manager' | 'working-manager';
    topology: TopologyPolicyConfig;
}): CounterfactualDecisionStability;
