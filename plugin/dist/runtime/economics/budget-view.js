import { workerDerivedOpenCodeCost, workerExactTokenUsage } from './usage-runtime.js';
function axis(input) { return { ...input, status: input.enforcement === 'unavailable' ? 'unavailable' : input.enforcement === 'observed-only' ? 'observed' : input.limit !== undefined && input.used >= input.limit ? 'exhausted' : 'within' }; }
function activeWorkers(m) { return m.execution.workers.filter(w => ['created', 'queued', 'starting', 'busy'].includes(w.status)).length; }
function currentRecoveryAttempts(m) { const sig = m.continuation.semantic_progress_snapshot?.state_hash ?? m.continuation.last_progress_signature; return (m.continuation.recovery_history ?? []).filter(x => x.progress_signature === sig && x.generation === m.continuation.generation && x.outcome !== 'failed').length; }
function workerAxes(m, w) {
    const task = m.execution.tasks.find(t => t.id === w.task_id), profile = task?.execution_profile, usage = workerExactTokenUsage(w), exactTokens = usage.input + usage.output + usage.reasoning + usage.cache_read + usage.cache_write, derivedCost = workerDerivedOpenCodeCost(w), observations = w.usage_observations ?? [], providerBilled = observations.filter(x => x.monetary?.source === 'provider-billed' && x.monetary.confidence === 'exact').reduce((n, x) => n + (x.monetary?.usd ?? 0), 0);
    const out = [
        axis({ axis: 'worker-attempts', used: w.attempt, unit: 'attempts', measurement: 'exact', enforcement: 'observed-only', source: 'canonical-worker-attempt' }),
        axis({ axis: 'exact-complete-token-usage', used: exactTokens, unit: 'tokens', measurement: 'exact', enforcement: 'observed-only', source: 'opencode-step-finish' }),
    ];
    if (profile) {
        out.push(axis({ axis: 'context-cap', used: profile.max_context_chars, limit: profile.max_context_chars, unit: 'characters', measurement: 'exact', enforcement: 'hard', source: 'execution-profile-max-context' }), axis({ axis: 'handoff-cap', used: Math.max(0, ...m.execution.ledger.filter(e => e.worker_id === w.id && e.type === 'worker.handoff').map(e => Number(e.payload?.chars ?? 0)).filter(Number.isFinite)), limit: profile.max_handoff_chars, unit: 'characters', measurement: 'exact', enforcement: 'hard', source: 'execution-profile-max-handoff' }), axis({ axis: 'result-cap', used: 0, limit: profile.max_result_chars, unit: 'characters', measurement: 'exact', enforcement: 'hard', source: 'result-parser-clipping' }), axis({ axis: 'artifact-cap', used: task?.context_artifacts.length ?? 0, limit: profile.max_artifacts, unit: 'artifacts', measurement: 'exact', enforcement: 'hard', source: 'execution-profile-max-artifacts' }));
    }
    if (providerBilled > 0)
        out.push(axis({ axis: 'provider-billed-cost', used: providerBilled, unit: 'USD', measurement: 'exact', enforcement: 'observed-only', source: 'provider-billed' }));
    if (derivedCost > 0)
        out.push(axis({ axis: 'opencode-derived-cost', used: derivedCost, unit: 'USD', measurement: 'derived', enforcement: 'observed-only', source: 'opencode-calculated' }));
    return out;
}
export function executionBudgetView(m, now = Date.now()) {
    const mission = [
        axis({ axis: 'continuation-turns', used: m.continuation.iteration, limit: m.continuation.continuation_budget, unit: 'turns', measurement: 'exact', enforcement: 'hard', source: 'continuation-budget' }),
        axis({ axis: 'semantic-recovery-strategies', used: currentRecoveryAttempts(m), limit: 5, unit: 'strategies-per-semantic-state', measurement: 'exact', enforcement: 'hard', source: 'recovery-governor-rungs' }),
        axis({ axis: 'topology-concurrency', used: activeWorkers(m), limit: m.execution.execution_mode === 'single' ? 1 : Math.max(1, m.execution.topology?.parallelism ?? 1), unit: 'active-workers', measurement: 'exact', enforcement: 'hard', source: 'scheduler-topology' }),
        axis({ axis: 'mission-wall-time', used: Math.max(0, now - m.identity.created_at), unit: 'milliseconds', measurement: 'exact', enforcement: 'observed-only', source: 'mission-clock-no-configured-hard-deadline' }),
    ];
    const workers = Object.fromEntries(m.execution.workers.map(w => [w.id, workerAxes(m, w)])), processes = Object.fromEntries(m.execution.processes.map(p => [p.process_id, [axis({ axis: 'process-wall-time', used: Math.max(0, (p.ended_at ?? now) - p.started_at), ...(p.timeout_at === undefined ? {} : { limit: Math.max(0, p.timeout_at - p.started_at) }), unit: 'milliseconds', measurement: 'exact', enforcement: p.timeout_at === undefined ? 'observed-only' : 'hard', source: p.timeout_at === undefined ? 'process-clock-no-timeout' : 'process-timeout' })]]));
    return { mission, workers, processes };
}
