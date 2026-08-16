import type { AuthorityStateContract } from './authority.js';
import type { ContextReferenceContract } from './context-reference.js';
import type { EvidenceItem } from './evidence.js';
import type { ExternalActionType } from './external-action.js';
import type { TaskContractStatus } from './task.js';
import type { WorkerContractStatus } from './worker.js';
import type { WorkerResult } from './worker-result.js';
/** Host-neutral capability semantics. Host adapters resolve these contracts. */
export type CapabilityImplementation = 'NATIVE' | 'HYBRID' | 'HI_OWNED' | 'UNAVAILABLE';
export interface CapabilityRequirement {
    capability: string;
    required: boolean;
    reason: string;
}
export interface CapabilityResolution {
    capability: string;
    implementation: CapabilityImplementation;
    available: boolean;
    semanticLoss: string[];
    reason: string[];
}
/**
 * Boundary implemented by OpenCode, another host, or a Hi-owned fallback.
 * Core code depends on capability semantics, never a host client/session API.
 */
export interface CapabilityPort<Request = unknown, Result = unknown> {
    readonly capability: string;
    resolve(requirement: CapabilityRequirement): CapabilityResolution | Promise<CapabilityResolution>;
    execute(request: Request): Promise<Result>;
}
export type WorkDependencyKind = 'requires';
export interface DependencyEdge {
    from: string;
    to: string;
    kind: WorkDependencyKind;
}
export interface WorkNode {
    id: string;
    missionId: string;
    objective: string;
    status: TaskContractStatus;
    scope: string[];
    constraints: string[];
    dependencies: string[];
    requiredEvidence: string[];
    obligationIds: string[];
    contextReferences: ContextReferenceContract[];
    externalActionRequirements: ExternalActionType[];
    gateIds: string[];
    createdAt: number;
    updatedAt: number;
}
export interface ExecutionResourceSelection {
    role: string;
    category: string;
    requestedModel?: string;
    requestedModelVariant?: string;
    selectedModel?: string;
    selectedModelVariant?: string;
    projectedModel?: string;
    projectedModelVariant?: string;
    effectiveModel?: string;
    effectiveModelVariant?: string;
    effectiveModelVerified?: boolean;
    effectiveModelVariantVerified?: boolean;
    effectiveModelSource?: string;
    fallbacks: string[];
    modelSelectionReason: string[];
}
export interface ExecutionAttempt {
    executionUnitId: string;
    ordinal: number;
    workerId?: string;
    status: WorkerContractStatus | 'unassigned';
    startedAt?: number;
    updatedAt: number;
    completedAt?: number;
    sessionId?: string;
    forkedFromSessionId?: string;
    generation: number;
    recoveryAttempt: number;
    lastFailureKind?: string;
    fallbackHistory: Array<{
        from?: string;
        to: string;
        variant?: string;
        reason: string;
        phase: 'dispatch' | 'runtime';
        at: number;
    }>;
}
export interface ExecutionUnit {
    id: string;
    missionId: string;
    workNodeId: string;
    objective: string;
    role: string;
    category: string;
    dependencies: string[];
    scope: string[];
    constraints: string[];
    requiredEvidence: string[];
    obligationIds: string[];
    contextReferences: ContextReferenceContract[];
    resourceSelection?: ExecutionResourceSelection;
    attempt?: ExecutionAttempt;
    workerFingerprint?: string;
    writeSet: string[];
    nativeStateHash?: string;
    result?: WorkerResult;
}
export interface ProgressObservation {
    missionId: string;
    generation: number;
    iteration: number;
    signature: string;
    stagnationCount: number;
    continuationBudget: number;
    continuationActive: boolean;
    reason?: string;
    observedAt: number;
}
export interface WorkGraph {
    missionId: string;
    objective: string;
    missionStatus: string;
    requiredCapabilities: string[];
    risk: string;
    executionMode: string;
    topology: {
        mode: string;
        parallelism: number;
        reason: string[];
    };
    nodes: WorkNode[];
    edges: DependencyEdge[];
    executionUnits: ExecutionUnit[];
    evidence: {
        fresh: boolean;
        lastMutationAt?: number;
        items: EvidenceItem[];
    };
    authority: {
        pendingPermissions: number;
        pendingPermissionIds: string[];
        state?: AuthorityStateContract;
    };
    blockers: string[];
    progress: ProgressObservation;
}
export interface WorkGraphValidation {
    ok: boolean;
    reasons: string[];
}
/** Mechanical graph invariants. Semantic policy belongs to planner/scheduler layers. */
export declare function validateWorkGraph(graph: WorkGraph): WorkGraphValidation;
export declare function isCapabilityResolution(value: unknown): value is CapabilityResolution;
