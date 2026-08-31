import { missionMetrics } from '../ledger/metrics.js';
import { executionBudgetView } from '../economics/budget-view.js';
/** Bounded operator projection. It persists no telemetry and never upgrades partial observations. */
export function observabilityEconomicsView(m, now = Date.now()) {
    const metrics = missionMetrics(m), causal = metrics.usage.causal, complete = metrics.usage.complete_observations, partial = metrics.usage.partial_observations;
    const coverage = complete && partial ? 'mixed' : complete ? 'complete-only' : partial ? 'partial-only' : 'unobserved';
    const workers = m.execution.workers.slice(-32).map(worker => {
        const observations = worker.usage_observations ?? [], c = observations.filter(x => x.coverage === 'assistant-step-total').length, p = observations.length - c;
        return { worker_id: worker.id, task_id: worker.task_id, role: worker.role, status: worker.status, model: worker.effective_model ?? worker.model, attempt: worker.attempt, ...(worker.started_at === undefined ? {} : { duration_ms: Math.max(0, (worker.completed_at ?? worker.updated_at ?? now) - worker.started_at) }), complete_observations: c, partial_observations: p };
    });
    return {
        mission_id: m.identity.mission_id, status: m.identity.status,
        lifecycle: { duration_ms: metrics.duration_ms, tasks: metrics.tasks_created, workers: metrics.agents_spawned, failed_workers: metrics.failed_workers, retries_and_resumes: metrics.same_session_resumes, recovery_events: metrics.continuation_recovery_events, recovery_success: metrics.continuation_recovery_success, stale_verification_blocks: metrics.stale_verification_blocks, premature_stop_blocks: metrics.premature_stop_blocks },
        usage: { complete_observations: complete, partial_observations: partial, coverage, exact_complete_tokens: metrics.usage.exact_complete_tokens, derived_opencode_cost_usd: metrics.usage.derived_opencode_cost_usd, monetary_basis: metrics.usage.monetary_basis, causal: { by_cause: causal.by_cause, repeat_exact_tokens: causal.repeat_exact_tokens, repeat_exact_context_tokens: causal.repeat_exact_context_tokens, unattributed_repeat_exact_tokens: causal.unattributed_repeat_exact_tokens, partial_observations: causal.partial_observations, cache_repayment: causal.cache_repayment } },
        budget: executionBudgetView(m, now), workers,
        claim_boundary: 'derived-from-canonical-worker-usage+mission-ledger', routing_authority: false, completion_authority: false, persistence_owner: 'none-derived-view',
    };
}
