import { missionMetrics } from '../ledger/metrics.js';
import { executionBudgetView } from '../economics/budget-view.js';
import { workerDerivedOpenCodeCost, workerExactTokenUsage } from '../economics/usage-runtime.js';
function totalTokens(tokens) { return tokens.input + tokens.output + tokens.reasoning + tokens.cache_read + tokens.cache_write; }
function exactProviderBilled(m) {
    return Number(m.execution.workers.flatMap(w => w.usage_observations ?? []).filter(x => x.monetary?.source === 'provider-billed' && x.monetary.confidence === 'exact').reduce((sum, x) => sum + (x.monetary?.usd ?? 0), 0).toFixed(12));
}
function allBudgetAxes(budget) { return [...budget.mission, ...Object.values(budget.workers).flat(), ...Object.values(budget.processes).flat()]; }
function modelRoleSummary(m) {
    const rows = new Map();
    for (const worker of m.execution.workers) {
        const model = worker.effective_model ?? worker.model ?? 'host-default', key = `${worker.role}\0${model}`, usage = workerExactTokenUsage(worker), providerBilled = Number((worker.usage_observations ?? []).filter(x => x.monetary?.source === 'provider-billed' && x.monetary.confidence === 'exact').reduce((sum, x) => sum + (x.monetary?.usd ?? 0), 0).toFixed(12)), existing = rows.get(key) ?? { model, role: worker.role, workers: 0, attempts: 0, exact_tokens: 0, cache_read: 0, cache_write: 0, derived_opencode_cost_usd: 0, provider_billed_exact_usd: 0 };
        existing.workers += 1;
        existing.attempts += Math.max(0, worker.attempt ?? 0);
        existing.exact_tokens += totalTokens(usage);
        existing.cache_read += usage.cache_read;
        existing.cache_write += usage.cache_write;
        existing.derived_opencode_cost_usd = Number((existing.derived_opencode_cost_usd + workerDerivedOpenCodeCost(worker)).toFixed(12));
        existing.provider_billed_exact_usd = Number((existing.provider_billed_exact_usd + providerBilled).toFixed(12));
        rows.set(key, existing);
    }
    return [...rows.values()].sort((a, b) => b.exact_tokens - a.exact_tokens || `${a.role}/${a.model}`.localeCompare(`${b.role}/${b.model}`)).slice(0, 16);
}
/** Bounded operator projection. It persists no telemetry and never upgrades partial observations. */
export function observabilityEconomicsView(m, now = Date.now()) {
    const metrics = missionMetrics(m), causal = metrics.usage.causal, complete = metrics.usage.complete_observations, partial = metrics.usage.partial_observations;
    const coverage = complete && partial ? 'mixed' : complete ? 'complete-only' : partial ? 'partial-only' : 'unobserved';
    const workers = m.execution.workers.slice(-32).map(worker => {
        const observations = worker.usage_observations ?? [], c = observations.filter(x => x.coverage === 'assistant-step-total').length, p = observations.length - c;
        return { worker_id: worker.id, task_id: worker.task_id, role: worker.role, status: worker.status, model: worker.effective_model ?? worker.model, attempt: worker.attempt, ...(worker.started_at === undefined ? {} : { duration_ms: Math.max(0, (worker.completed_at ?? worker.updated_at ?? now) - worker.started_at) }), complete_observations: c, partial_observations: p };
    });
    const budget = executionBudgetView(m, now), axes = allBudgetAxes(budget), tokens = metrics.usage.exact_complete_tokens, exactTotal = totalTokens(tokens), exactContext = tokens.input + tokens.cache_read + tokens.cache_write, providerBilled = exactProviderBilled(m), derived = metrics.usage.derived_opencode_cost_usd, hard = axes.filter(x => x.enforcement === 'hard'), topCauses = Object.entries(causal.by_cause).filter(([, row]) => row.exact_complete_tokens > 0 || row.derived_opencode_cost_usd > 0 || row.provider_billed_cost_usd > 0).sort((a, b) => b[1].exact_complete_tokens - a[1].exact_complete_tokens || a[0].localeCompare(b[0])).slice(0, 8).map(([cause, row]) => ({ cause, exact_tokens: row.exact_complete_tokens, derived_opencode_cost_usd: row.derived_opencode_cost_usd, provider_billed_cost_usd: row.provider_billed_cost_usd })), displayBasis = providerBilled > 0 ? 'provider-billed-exact' : derived > 0 ? 'opencode-calculated-derived' : 'unavailable';
    const productSummary = {
        exact_token_total: exactTotal, exact_context_tokens: exactContext,
        cache: { read: tokens.cache_read, write: tokens.cache_write, share_of_exact_context: exactContext > 0 ? Number((tokens.cache_read / exactContext).toFixed(6)) : null, claim_boundary: 'observed-token-volume-not-cache-savings' },
        money: { provider_billed_exact_usd: providerBilled > 0 ? providerBilled : null, opencode_derived_usd: derived > 0 ? derived : null, display_basis: displayBasis, hard_budget_enforced: false },
        repeat_compute: { exact_tokens: causal.repeat_exact_tokens, exact_context_tokens: causal.repeat_exact_context_tokens, share_of_exact_tokens: exactTotal > 0 ? Number((causal.repeat_exact_tokens / exactTotal).toFixed(6)) : null, top_causes: topCauses },
        budgets: { hard: { within: hard.filter(x => x.status === 'within').length, exhausted: hard.filter(x => x.status === 'exhausted').length, unavailable: hard.filter(x => x.status === 'unavailable').length }, observed_only: axes.filter(x => x.enforcement === 'observed-only').length, unavailable_measurements: axes.filter(x => x.measurement === 'unavailable').length, note: 'Hard limits are enforced only by their existing exact owners. Token and monetary usage remain observed-only unless an exact enforceable limit exists; derived or partial money is never promoted to a hard budget.' },
        by_model_role: modelRoleSummary(m),
        coverage_note: coverage === 'unobserved' ? 'No host usage observation is available; Hi reports no fabricated token or monetary totals.' : coverage === 'partial-only' ? 'Only partial assistant usage is available; exact complete totals remain zero.' : coverage === 'mixed' ? 'Exact complete totals exclude separately reported partial observations.' : 'Exact complete totals use host step-finish observations; monetary provenance remains independently labeled.',
    };
    return {
        mission_id: m.identity.mission_id, status: m.identity.status,
        lifecycle: { duration_ms: metrics.duration_ms, tasks: metrics.tasks_created, workers: metrics.agents_spawned, failed_workers: metrics.failed_workers, retries_and_resumes: metrics.same_session_resumes, recovery_events: metrics.continuation_recovery_events, recovery_success: metrics.continuation_recovery_success, stale_verification_blocks: metrics.stale_verification_blocks, premature_stop_blocks: metrics.premature_stop_blocks },
        usage: { complete_observations: complete, partial_observations: partial, coverage, exact_complete_tokens: metrics.usage.exact_complete_tokens, derived_opencode_cost_usd: metrics.usage.derived_opencode_cost_usd, monetary_basis: metrics.usage.monetary_basis, causal: { by_cause: causal.by_cause, repeat_exact_tokens: causal.repeat_exact_tokens, repeat_exact_context_tokens: causal.repeat_exact_context_tokens, unattributed_repeat_exact_tokens: causal.unattributed_repeat_exact_tokens, partial_observations: causal.partial_observations, cache_repayment: causal.cache_repayment } },
        budget, product_summary: productSummary, workers,
        claim_boundary: 'derived-from-canonical-worker-usage+mission-ledger', routing_authority: false, completion_authority: false, persistence_owner: 'none-derived-view',
    };
}
