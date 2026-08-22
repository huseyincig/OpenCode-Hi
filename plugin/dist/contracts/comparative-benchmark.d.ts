import type { ExecutionTokenUsage } from './execution-usage.js';
export declare const COMPARATIVE_BENCHMARK_SCHEMA: 1;
export type BenchmarkSystemKind = 'VANILLA_OPENCODE' | 'OPENCODE_HI_BASELINE' | 'OPENCODE_HI_CURRENT' | 'EXTERNAL_BASELINE';
export type BenchmarkEpisodeKind = 'DETERMINISTIC_FIXTURE' | 'REAL_HOST_EPISODE' | 'POLICY_ABLATION';
export type BenchmarkScenarioClass = 'trivial-localized-work' | 'failing-test-fix' | 'independent-parallel-work' | 'dependency-fan-in' | 'mutable-surface-conflict' | 'verification-route-unavailable' | 'independent-review-required' | 'misleading-done' | 'mutation-after-verification' | 'provider-child-failure' | 'restart-stale-callback' | 'authority-ambiguous-replay' | 'context-heavy-investigation' | 'plugin-config-coexistence' | 'production-commit-task';
export type BenchmarkCheckStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_RUN';
export type BenchmarkResultClassification = 'VERIFIED_SUCCESS' | 'VERIFIED_FAILURE' | 'BLOCKED_ENVIRONMENT' | 'BLOCKED_AUTHORITY' | 'TIMEOUT' | 'INVALID_RECEIPT';
export interface BenchmarkSystemIdentity {
    kind: BenchmarkSystemKind;
    label: string;
    opencode_version: string;
    opencode_commit?: string;
    hi_commit?: string;
    external_version?: string;
    config_sha256: string;
}
export interface BenchmarkTaskIdentity {
    task_id: string;
    scenario_class: BenchmarkScenarioClass;
    fixture_sha256: string;
    repo?: string;
    from_commit?: string;
    to_commit?: string;
}
export interface BenchmarkModelIdentity {
    requested?: string;
    effective?: string;
    provider_effective?: string;
}
export interface BenchmarkDeterministicCheck {
    id: string;
    status: BenchmarkCheckStatus;
    exit_code?: number;
    evidence_refs: string[];
    detail?: string;
}
export interface BenchmarkEvidenceSummary {
    required: number;
    satisfied: number;
    fresh: number;
    stale: number;
    wrong_task_accepted: number;
    wrong_attempt_accepted: number;
    false_completion: number;
}
export interface BenchmarkControlPlaneMetrics {
    duplicate_dispatch_count: number;
    stale_callback_accept_count: number;
    ambiguous_side_effect_replay_count: number;
    deadlock_or_stall_count: number;
    orphan_or_cleanup_failure_count: number;
    workers_spawned: number;
    retries: number;
    replans: number;
    tool_calls: number;
    model_calls: number;
    polling_calls: number;
    peak_concurrent_workers: number;
    context_bytes_to_children: number;
    mechanically_identified_redundant_actions: number;
}
export interface BenchmarkExactUsage {
    tokens: ExecutionTokenUsage;
    coverage: 'COMPLETE_STEP_TOTAL' | 'PARTIAL_MESSAGE_REPORTED';
    source: 'OPENCODE_STEP_FINISH' | 'OPENCODE_ASSISTANT_MESSAGE' | 'PROVIDER_USAGE';
}
export interface BenchmarkEstimatedUsage {
    tokens?: number;
    cost_usd?: number;
    method: string;
}
export interface BenchmarkEconomics {
    wall_time_ms: number;
    exact_usage?: BenchmarkExactUsage;
    estimated_usage?: BenchmarkEstimatedUsage;
    provider_billed_cost_usd?: number;
    opencode_derived_cost_usd?: number;
}
export interface BenchmarkFailureInjection {
    id: string;
    kind: string;
    applied: boolean;
    observed: boolean;
}
export interface BenchmarkArtifacts {
    diff_sha256?: string;
    acceptance_log_sha256?: string;
    receipt_inputs_sha256: string;
}
export interface ComparativeBenchmarkReceipt {
    schema: typeof COMPARATIVE_BENCHMARK_SCHEMA;
    episode_kind: BenchmarkEpisodeKind;
    claim_boundary: string;
    episode_id: string;
    repetition: number;
    system: BenchmarkSystemIdentity;
    task: BenchmarkTaskIdentity;
    model: BenchmarkModelIdentity;
    started_at: string;
    ended_at: string;
    deterministic_checks: BenchmarkDeterministicCheck[];
    evidence: BenchmarkEvidenceSummary;
    completion_decision: string;
    failure_injections: BenchmarkFailureInjection[];
    control_plane: BenchmarkControlPlaneMetrics;
    economics: BenchmarkEconomics;
    artifacts: BenchmarkArtifacts;
    result: BenchmarkResultClassification;
}
export declare function isComparativeBenchmarkReceipt(v: unknown): v is ComparativeBenchmarkReceipt;
