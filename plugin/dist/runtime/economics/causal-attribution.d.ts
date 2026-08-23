import type { ExecutionTokenUsage, ExecutionUsageObservation } from '../../contracts/execution-usage.js';
import type { MissionState } from '../mission/types.js';
export type CausalComputeCause = 'PRIMARY_EXECUTION' | 'CORRECTIVE_RETRY' | 'BEHAVIORAL_MODEL_ESCALATION' | 'PROVIDER_RUNTIME_FALLBACK' | 'WRITE_CONFLICT_RECONCILIATION' | 'CONSTRAINT_REBASE' | 'SEMANTIC_FOLLOWUP_RESUME' | 'RESTART_RECONCILIATION' | 'REPEATED_EXECUTION_UNATTRIBUTED';
export interface CausalUsageRow {
    worker_id: string;
    task_id: string;
    generation: number;
    attempt_ordinal: number;
    cause: CausalComputeCause;
    lifecycle_attribution: 'exact' | 'unattributed';
    coverage: ExecutionUsageObservation['coverage'];
    observation_ids: string[];
    tokens: ExecutionTokenUsage;
    total_tokens: number;
    context_tokens: number;
    derived_opencode_cost_usd: number;
    provider_billed_cost_usd: number;
}
export interface CausalCauseSummary {
    observations: number;
    attempts: number;
    exact_complete_tokens: number;
    exact_complete_context_tokens: number;
    derived_opencode_cost_usd: number;
    provider_billed_cost_usd: number;
}
export interface MissionCausalUsageAttribution {
    rows: CausalUsageRow[];
    by_cause: Partial<Record<CausalComputeCause, CausalCauseSummary>>;
    exact_complete_tokens: number;
    exact_complete_context_tokens: number;
    repeat_exact_tokens: number;
    repeat_exact_context_tokens: number;
    unattributed_repeat_exact_tokens: number;
    partial_observations: number;
    basis: 'canonical-worker-attempt-usage+mission-ledger';
    cache_repayment: 'unavailable-without-per-turn-prefix-and-ttl-evidence';
    routing_authority: false;
}
export declare function missionCausalUsageAttribution(m: MissionState): MissionCausalUsageAttribution;
