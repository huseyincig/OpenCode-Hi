import type { MissionState } from '../mission/types.js';
import { executionBudgetView } from '../economics/budget-view.js';
export interface ObservabilityEconomicsView {
    mission_id: string;
    status: string;
    lifecycle: {
        duration_ms: number;
        tasks: number;
        workers: number;
        failed_workers: number;
        retries_and_resumes: number;
        recovery_events: number;
        recovery_success: number;
        stale_verification_blocks: number;
        premature_stop_blocks: number;
    };
    usage: {
        complete_observations: number;
        partial_observations: number;
        coverage: 'complete-only' | 'mixed' | 'partial-only' | 'unobserved';
        exact_complete_tokens: {
            input: number;
            output: number;
            reasoning: number;
            cache_read: number;
            cache_write: number;
        };
        derived_opencode_cost_usd: number;
        monetary_basis: 'opencode-calculated-derived';
        causal: {
            by_cause: Record<string, {
                observations: number;
                attempts: number;
                exact_complete_tokens: number;
                exact_complete_context_tokens: number;
                derived_opencode_cost_usd: number;
                provider_billed_cost_usd: number;
            }>;
            repeat_exact_tokens: number;
            repeat_exact_context_tokens: number;
            unattributed_repeat_exact_tokens: number;
            partial_observations: number;
            cache_repayment: 'unavailable-without-per-turn-prefix-and-ttl-evidence';
        };
    };
    budget: ReturnType<typeof executionBudgetView>;
    workers: Array<{
        worker_id: string;
        task_id: string;
        role: string;
        status: string;
        model?: string;
        attempt: number;
        duration_ms?: number;
        complete_observations: number;
        partial_observations: number;
    }>;
    claim_boundary: 'derived-from-canonical-worker-usage+mission-ledger';
    routing_authority: false;
    completion_authority: false;
    persistence_owner: 'none-derived-view';
}
/** Bounded operator projection. It persists no telemetry and never upgrades partial observations. */
export declare function observabilityEconomicsView(m: MissionState, now?: number): ObservabilityEconomicsView;
