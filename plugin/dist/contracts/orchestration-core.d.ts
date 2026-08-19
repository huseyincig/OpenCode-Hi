import type { AuthorityStateContract } from './authority.js';
import type { ContextReferenceContract } from './context-reference.js';
import type { EvidenceItem } from './evidence.js';
import type { ExternalActionType } from './external-action.js';
import type { TaskContractStatus } from './task.js';
import type { WorkerContractStatus } from './worker.js';
import type { WorkerResult } from './worker-result.js';
/** Host-neutral capability semantics. Host adapters resolve these contracts. */
export type CapabilityImplementation = 'NATIVE' | 'HYBRID' | 'HI_OWNED' | 'UNAVAILABLE';
export interface CapabilityResolution {
    capability: string;
    implementation: CapabilityImplementation;
    available: boolean;
    semanticLoss: string[];
    reason: string[];
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
export interface ExecutionAttemptIdentity {
    executionUnitId: string;
    attemptId: string;
    runId: string;
    ordinal: number;
    generation: number;
}
export interface ExecutionAttempt extends ExecutionAttemptIdentity {
    workerId: string;
    status: WorkerContractStatus | 'unassigned';
    startedAt?: number;
    updatedAt: number;
    completedAt?: number;
    sessionId?: string;
    forkedFromSessionId?: string;
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
export declare function executionAttemptIdentity(input: {
    executionUnitId: string;
    workerId: string;
    ordinal: number;
    generation: number;
}): ExecutionAttemptIdentity;
export declare function sameExecutionAttempt(a: Pick<ExecutionAttemptIdentity, 'executionUnitId' | 'attemptId' | 'runId' | 'generation'>, b: Pick<ExecutionAttemptIdentity, 'executionUnitId' | 'attemptId' | 'runId' | 'generation'>): boolean;
export declare function sameExecutionAttemptFence(a: Pick<ExecutionAttempt, 'executionUnitId' | 'attemptId' | 'runId' | 'generation' | 'workerId' | 'sessionId'>, b: Pick<ExecutionAttempt, 'executionUnitId' | 'attemptId' | 'runId' | 'generation' | 'workerId' | 'sessionId'>): boolean;
export type ExecutionTransitionKind = 'DISPATCH' | 'SETTLEMENT' | 'EVIDENCE_COMMIT';
export declare function executionTransitionReceiptId(input: {
    missionId: string;
    workNodeId: string;
    attempt: ExecutionAttemptIdentity;
    transition: ExecutionTransitionKind;
}): string;
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
export interface ProgressDelta {
    stateChanged: boolean;
    evidenceAdded: number;
    evidenceInvalidated: number;
    dependencyCompletions: number;
    changedFiles: number;
    failureSignatureChanged: boolean;
    executionAdvanced: boolean;
    signals: string[];
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
    delta?: ProgressDelta;
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
export type SchedulingDisposition = 'RUNNABLE' | 'ACTIVE' | 'WAITING_DEPENDENCY' | 'BLOCKED_DEPENDENCY' | 'BLOCKED_STATE' | 'DEFERRED_CONFLICT' | 'DEFERRED_CAPACITY' | 'TERMINAL';
export type SchedulingReasonCode = 'ready' | 'already-active' | 'terminal-work' | 'unknown-dependency' | 'dependency-incomplete' | 'dependency-failed' | 'dependency-cancelled' | 'task-blocked' | 'mutable-surface-conflict' | 'shared-mutable-surface' | 'topology-capacity' | 'global-capacity' | 'provider-capacity' | 'model-capacity';
export interface SchedulingResourceBinding {
    provider?: string;
    model?: string;
}
export interface SchedulingUnitTraits {
    readOnly: boolean;
}
export interface SchedulingRunningAllocation extends SchedulingResourceBinding {
    executionUnitId: string;
}
export interface SchedulingCapacityState {
    topology: number;
    global: number;
    providers: Record<string, number>;
    models: Record<string, number>;
    running: SchedulingRunningAllocation[];
}
export interface SchedulingSnapshot {
    graph: WorkGraph;
    unitTraits: Record<string, SchedulingUnitTraits>;
    resolvedResources: Record<string, SchedulingResourceBinding | undefined>;
    capacity: SchedulingCapacityState;
}
export interface SchedulingUnitDecision {
    executionUnitId: string;
    disposition: SchedulingDisposition;
    reasons: Array<{
        code: SchedulingReasonCode;
        detail?: string;
    }>;
    blockingUnitIds: string[];
    blockingDependencyIds: string[];
}
export interface SchedulingDecision {
    missionId: string;
    units: SchedulingUnitDecision[];
}
export type SchedulerReservationPhase = 'RESERVED' | 'RUNNING' | 'SETTLING' | 'RECONCILING';
export interface SchedulerReservation {
    reservationId: string;
    missionId: string;
    workNodeId: string;
    executionUnitId: string;
    workerId: string;
    attempt: ExecutionAttemptIdentity;
    phase: SchedulerReservationPhase;
    resource: SchedulingResourceBinding;
    ticket: number;
    reservedAt: number;
    updatedAt: number;
    hostExecutionId?: string;
}
export interface SchedulerLifecycleState {
    missionId: string;
    revision: number;
    nextTicket: number;
    reservations: SchedulerReservation[];
}
export type SchedulerReconcileOutcome = 'ACTIVE' | 'NOT_STARTED' | 'TERMINAL' | 'UNKNOWN';
export type SchedulerLifecycleEvent = {
    type: 'RESERVE';
    missionId: string;
    workNodeId: string;
    workerId: string;
    attempt: ExecutionAttemptIdentity;
    resource: SchedulingResourceBinding;
    at: number;
} | {
    type: 'HOST_BOUND';
    reservationId: string;
    attempt: ExecutionAttemptIdentity;
    hostExecutionId: string;
    at: number;
} | {
    type: 'BEGIN_SETTLEMENT';
    reservationId: string;
    attempt: ExecutionAttemptIdentity;
    hostExecutionId?: string;
    at: number;
} | {
    type: 'RELEASE';
    reservationId: string;
    attempt: ExecutionAttemptIdentity;
    hostExecutionId?: string;
    at: number;
} | {
    type: 'CANCEL';
    reservationId: string;
    attempt: ExecutionAttemptIdentity;
    hostExecutionId?: string;
    at: number;
} | {
    type: 'RESTART_QUARANTINE';
    at: number;
} | {
    type: 'RECONCILE';
    reservationId: string;
    attempt: ExecutionAttemptIdentity;
    hostExecutionId?: string;
    outcome: SchedulerReconcileOutcome;
    at: number;
};
export interface SchedulerLifecycleResult {
    accepted: boolean;
    reason: string;
    state: SchedulerLifecycleState;
    reservation?: SchedulerReservation;
}
export declare function createSchedulerLifecycleState(missionId: string): SchedulerLifecycleState;
export declare function schedulerReservationId(input: {
    missionId: string;
    workNodeId: string;
    attempt: ExecutionAttemptIdentity;
}): string;
export declare function isSchedulerLifecycleState(value: unknown): value is SchedulerLifecycleState;
