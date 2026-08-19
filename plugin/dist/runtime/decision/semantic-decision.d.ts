import type { Category, MissionState, NormalizedMissionIntent, PrimaryMode, VerificationPolicy } from '../mission/types.js';
import { type ExecutionPath } from '../execution/adaptive-policy.js';
import { type TopologyDecision, type TopologyPolicyConfig } from '../execution/topology-policy.js';
export type IsolationIntent = 'NONE' | 'CANDIDATE';
export type ProviderSurfacePhase = 'DIRECT_CONTROL' | 'EVIDENCE_CONTROL' | 'GRAPH_CONTROL' | 'ESCALATED_CONTROL';
export interface SemanticCapabilityIntent {
    required: string[];
    repository: boolean;
    sourceWeb: boolean;
    browser: boolean;
    process: boolean;
    workspaceIsolationCandidate: boolean;
}
export interface SemanticDecisionEnvelope {
    version: 1;
    executionPath: ExecutionPath;
    executionReasons: string[];
    topology: TopologyDecision;
    primary: PrimaryMode;
    teamDirect: boolean;
    childRoles: string[];
    modelClass: Category;
    continuationBudget: number;
    assurance: {
        freshReviewerRequired: boolean;
    };
    isolation: {
        intent: IsolationIntent;
        reason: string[];
    };
    capabilities: SemanticCapabilityIntent;
    providerSurfacePhase: ProviderSurfacePhase;
    reasons: string[];
}
export interface SemanticDecisionInput {
    intent: NormalizedMissionIntent;
    verification: VerificationPolicy;
    primaryMode?: 'auto' | PrimaryMode;
    topology: TopologyPolicyConfig;
    mission?: MissionState;
}
/**
 * Host-neutral Phase 2 decision composition.
 *
 * This function deliberately performs no repository scan, host call, model call,
 * capability probe, mutation, or durable-state write. It composes bounded Phase 1
 * policies into one inspectable decision target; concrete model/tool/backend
 * availability remains a downstream adapter/runtime concern.
 */
export declare function decideSemanticExecution(input: SemanticDecisionInput): SemanticDecisionEnvelope;
