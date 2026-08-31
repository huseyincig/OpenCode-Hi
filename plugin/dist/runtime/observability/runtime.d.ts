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
    product_summary: {
        exact_token_total: number;
        exact_context_tokens: number;
        cache: {
            read: number;
            write: number;
            share_of_exact_context: number | null;
            claim_boundary: 'observed-token-volume-not-cache-savings';
        };
        money: {
            provider_billed_exact_usd: number | null;
            opencode_derived_usd: number | null;
            display_basis: 'provider-billed-exact' | 'opencode-calculated-derived' | 'unavailable';
            hard_budget_enforced: false;
        };
        repeat_compute: {
            exact_tokens: number;
            exact_context_tokens: number;
            share_of_exact_tokens: number | null;
            top_causes: Array<{
                cause: string;
                exact_tokens: number;
                derived_opencode_cost_usd: number;
                provider_billed_cost_usd: number;
            }>;
        };
        budgets: {
            hard: {
                within: number;
                exhausted: number;
                unavailable: number;
            };
            observed_only: number;
            unavailable_measurements: number;
            note: string;
        };
        by_model_role: Array<{
            model: string;
            role: string;
            workers: number;
            attempts: number;
            exact_tokens: number;
            cache_read: number;
            cache_write: number;
            derived_opencode_cost_usd: number;
            provider_billed_exact_usd: number;
        }>;
        coverage_note: string;
    };
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
