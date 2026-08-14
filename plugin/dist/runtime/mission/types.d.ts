import type { HiPrimaryRole } from '../roles/catalog.js';
import type { WorkerResult } from '../../contracts/worker-result.js';
import type { EvidenceItem } from '../../contracts/evidence.js';
import type { TaskContract, TaskContractStatus } from '../../contracts/task.js';
import type { WorkerContract, WorkerContractStatus } from '../../contracts/worker.js';
import type { ContextReferenceContract } from '../../contracts/context-reference.js';
export type { EvidenceItem } from '../../contracts/evidence.js';
export { WORKER_EVIDENCE_KINDS } from '../../contracts/worker-result.js';
export type { EvidenceOutcome, MethodologyObservation, WorkerEvidenceKind, WorkerResult, WorkerResultStatus } from '../../contracts/worker-result.js';
export type MissionStatus = 'active' | 'waiting-user' | 'completed' | 'stopped' | 'failed';
export type Risk = 'low' | 'medium' | 'high' | 'authority-boundary';
export type ExecutionMode = 'single' | 'parallel' | 'team';
export type PrimaryMode = HiPrimaryRole;
export type ObligationStatus = 'open' | 'closed' | 'blocked';
export type ObligationKind = 'analysis' | 'implementation' | 'verification' | 'review' | 'authority';
export type TaskStatus = TaskContractStatus;
export type WorkerStatus = WorkerContractStatus;
export type Category = 'quick' | 'standard' | 'deep' | 'visual' | 'critical';
export type GateStatus = 'open' | 'ready' | 'blocked' | 'closed';
export type GateKind = 'verification' | 'user-authority' | 'reviewer' | 'prerequisite-task' | 'precondition' | 'rollback';
export interface Obligation {
    id: string;
    status: ObligationStatus;
    kind: ObligationKind;
    summary: string;
    requiredEvidence?: string[];
    blocker?: string;
    closedAt?: number;
}
export interface ContextArtifact {
    id: string;
    kind: string;
    uri?: string;
    title?: string;
    summary?: string;
    sha256?: string;
    added_at: number;
}
export interface MissionGate {
    id: string;
    kind: GateKind;
    summary: string;
    status: GateStatus;
    reason?: string;
    updated_at: number;
}
export interface RuntimeNudge {
    id: string;
    reason: string;
    instruction: string;
    created_at: number;
    generation: number;
    task_id?: string;
    worker_id?: string;
}
export interface TemporaryMutation {
    id: string;
    kind: string;
    description: string;
    rollback_command: string;
    rollback_hash: string;
    rollback_mode?: 'command' | 'native-revert';
    session_id?: string;
    message_id?: string;
    status: 'active' | 'rolled-back' | 'failed';
    created_at: number;
    resolved_at?: number;
    detail?: string;
}
export interface PermissionProfileSnapshot {
    skill_tool_enabled: boolean;
    skill_permissions: Record<string, 'allow' | 'ask' | 'deny'>;
    external_effects: 'parent-only';
    recursive_task: 'deny';
    native?: {
        mode?: string;
        decisions: Record<string, 'allow' | 'ask' | 'deny' | 'unknown'>;
        source: 'effective-opencode-agent' | 'hi-default-invariants';
    };
}
export interface ExecutionProfile {
    role: string;
    category: Category;
    task: {
        objective: string;
        scope: string[];
        dependencies: string[];
        required_evidence: string[];
    };
    tools: string[];
    model?: string;
    model_variant?: string;
    fallback_models: string[];
    fallback_variants?: Record<string, string | undefined>;
    fallback_reasons?: Array<{
        model: string;
        variant?: string;
        reason: string;
    }>;
    methodologies: string[];
    permission_profile: PermissionProfileSnapshot;
    verification_policy: VerificationPolicy;
    max_context_chars: number;
    max_handoff_chars: number;
    max_result_chars: number;
    max_artifacts: number;
    expected_turns?: number;
    context_overhead?: number;
}
export interface MissionTask extends TaskContract {
    status: TaskStatus;
    category: Category;
    context_artifacts: ContextReferenceContract[];
    execution_profile?: ExecutionProfile;
    result?: WorkerResult;
}
export interface MethodologyProvenance {
    name: string;
    provider: 'project' | 'personal' | 'hi';
    source_path: string;
    source_sha256?: string;
    permission: 'allow' | 'ask' | 'deny';
    injection: 'native-skill-tool' | 'none';
    selected_at: number;
}
export interface WorkerState extends WorkerContract {
    status: WorkerStatus;
    category: Category;
    methodologies: MethodologyProvenance[];
}
export interface LedgerEvent {
    id: string;
    at: number;
    mission_id: string;
    type: string;
    task_id?: string;
    worker_id?: string;
    payload?: Record<string, unknown>;
}
export interface VerificationPolicy {
    requiredKinds: string[];
    requireFresh: boolean;
    requireReview: boolean;
    allowWorkerReportedEvidence: boolean;
}
export interface HiMethodologyNeed {
    name: string;
    signal: string;
    trigger_source: string;
    producer: string;
    reason: string;
    created_at: number;
    task_id?: string;
    obligation_id?: string;
}
export interface SemanticAssessmentState {
    status: 'pending' | 'assessed';
    phase: 'initial' | 'followup';
    revision: number;
    source: 'host-primary';
    pending_text: string;
    assessed_at?: number;
}
export interface NormalizedMissionIntent {
    objective: string;
    likelyTargets?: string[];
    taskKind: string;
    scope: 'local' | 'multi-file' | 'repo-wide' | 'external' | 'multi-stream';
    risk: Risk;
    ambiguity: 'none' | 'resolvable' | 'contract-critical';
    dependencyClass: 'independent' | 'sequential' | 'external-gated' | 'unknown' | 'independent-multi';
    requiredCapabilities: string[];
    requestedExternalActions: Array<'git-push' | 'release-create' | 'package-publish' | 'deploy'>;
    likelyVerification: string[];
    avoid: string[];
}
export interface MissionState {
    mission_id: string;
    session_id: string;
    objective: string;
    intent: NormalizedMissionIntent;
    semantic_assessment: SemanticAssessmentState;
    status: MissionStatus;
    risk: Risk;
    execution_mode: ExecutionMode;
    primary_mode: PrimaryMode;
    verification_policy: VerificationPolicy;
    adaptive_execution?: {
        path: 'DIRECT' | 'EVIDENCE' | 'PLANNED' | 'ESCALATED';
        reasons: string[];
    };
    topology?: {
        mode: 'single-agent' | 'multi-agent';
        parallelism: number;
        reason: string[];
    };
    generation: number;
    iteration: number;
    continuation_budget: number;
    continuation_active: boolean;
    suppress_until?: number;
    obligations: Obligation[];
    tasks: MissionTask[];
    workers: WorkerState[];
    evidence: {
        fresh: boolean;
        items: EvidenceItem[];
        last_mutation_at?: number;
    };
    ledger: LedgerEvent[];
    changed_files: string[];
    blockers: string[];
    constraints: string[];
    preexisting_user_changes?: Record<string, string>;
    preexisting_user_baseline_captured?: boolean;
    staging_safety?: {
        verified_files: string[];
        verified_at: number;
        source: string;
    };
    git_topology_safety?: {
        clean: boolean;
        verified_files: string[];
        verified_at: number;
        source: string;
    };
    git_topology_pending?: {
        command: string;
        started_at: number;
        ownership_captured?: boolean;
        conflict_files?: string[];
    };
    git_topology_owned_files?: string[];
    native_todos_incomplete: number;
    last_progress_signature: string;
    stagnation_count: number;
    continuation_reason?: string;
    continuation_lock_until?: number;
    last_continuation_at?: number;
    last_action_id?: string;
    active_action_id?: string;
    continuation_failure_count?: number;
    last_continuation_failure_at?: number;
    pending_nudge?: RuntimeNudge;
    context_artifacts: ContextArtifact[];
    gates: MissionGate[];
    temporary_mutations: TemporaryMutation[];
    methodology_needs: HiMethodologyNeed[];
    parent_loaded_methodologies: string[];
    pending_permissions: number;
    pending_permission_ids?: string[];
    user_interrupted: boolean;
    interrupted_at?: number;
    interrupted_reason?: string;
    resumed_at?: number;
    resume_count?: number;
    last_user_message_at?: number;
    authority?: {
        pending?: {
            hash: string;
            action: string;
            created_at: number;
        };
        approved?: {
            hash: string;
            approved_at: number;
        };
        executing?: {
            hash: string;
            action: string;
            started_at: number;
        };
        completed_hashes?: string[];
    };
    release_chain?: {
        local_revision_at?: number;
        last_local_command?: string;
        quality?: {
            version?: string;
            verified: boolean;
            verified_at: number;
            assets: Array<{
                path: string;
                sha256?: string;
                manifest_match?: boolean;
            }>;
        };
        push?: {
            outcome: 'success' | 'failure' | 'unknown';
            at: number;
            command: string;
            expected_remote?: string;
            expected_ref?: string;
            local_head?: string;
            observed_remote?: string;
            observed_ref?: string;
            remote_hash?: string;
            remote_verified?: boolean;
            remote_verified_at?: number;
        };
        tag_push?: {
            outcome: 'success' | 'failure' | 'unknown';
            at: number;
            command: string;
            expected_remote?: string;
            expected_tag?: string;
            expected_commit?: string;
            observed_remote?: string;
            direct_tag_hash?: string;
            peeled_tag_hash?: string;
            remote_verified?: boolean;
            remote_verified_at?: number;
        };
        release?: {
            outcome: 'success' | 'failure' | 'unknown';
            at: number;
            command: string;
            expected_tag?: string;
            expected_target?: string;
            expected_commit?: string;
            expected_remote?: string;
            observed_tag?: string;
            observed_target?: string;
            observed_remote?: string;
            direct_tag_hash?: string;
            peeled_tag_hash?: string;
            view_verified?: boolean;
            assets_verified?: boolean;
            observed_assets?: Array<{
                name: string;
                size?: number;
            }>;
            remote_verified?: boolean;
            remote_verified_at?: number;
        };
        package?: {
            name?: string;
            version?: string;
            pack_integrity?: string;
            pack_shasum?: string;
            pack_filename?: string;
            pack_files?: string[];
            pack_state_hash?: string;
            pack_verified_at?: number;
            outcome?: 'success' | 'failure' | 'unknown';
            published_at?: number;
            registry_version?: string;
            registry_integrity?: string;
            registry_shasum?: string;
            remote_verified?: boolean;
            remote_verified_at?: number;
        };
        blocked_reason?: string;
    };
    applied_actions?: Record<string, string>;
    created_at: number;
    updated_at: number;
}
