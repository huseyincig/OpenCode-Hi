import { EMPTY_TOKEN_USAGE, addTokenUsage } from '../../contracts/execution-usage.js';
const EVENT_CAUSE = [
    ['parallel.write-conflict.resumed', 'WRITE_CONFLICT_RECONCILIATION'],
    ['worker.constraint-rebased', 'CONSTRAINT_REBASE'],
    ['worker.runtime-fallback', 'PROVIDER_RUNTIME_FALLBACK'],
    ['worker.model-escalated', 'BEHAVIORAL_MODEL_ESCALATION'],
    ['worker.resumed', 'CORRECTIVE_RETRY'],
    ['worker.semantic-resumed', 'SEMANTIC_FOLLOWUP_RESUME'],
    ['scheduler.restart-reconciled', 'RESTART_RECONCILIATION'],
];
function total(t) { return t.input + t.output + t.reasoning + t.cache_read + t.cache_write; }
function context(t) { return t.input + t.cache_read + t.cache_write; }
function eventIndexForObservation(events, workerID, observationID) { return events.findIndex(e => e.worker_id === workerID && e.type === 'worker.usage-observed' && e.payload?.observation_id === observationID); }
function causeForAttempt(events, worker, attempt, firstObservationID, previousObservationID) {
    if (attempt <= 1)
        return { cause: 'PRIMARY_EXECUTION', confidence: 'exact' };
    const end = eventIndexForObservation(events, worker.id, firstObservationID), start = previousObservationID ? eventIndexForObservation(events, worker.id, previousObservationID) : -1;
    const window = end >= 0 ? events.slice(Math.max(0, start + 1), end) : [];
    for (const [type, cause] of EVENT_CAUSE) {
        if (window.some(e => e.worker_id === worker.id && e.type === type))
            return { cause, confidence: 'exact' };
    }
    return { cause: 'REPEATED_EXECUTION_UNATTRIBUTED', confidence: 'unattributed' };
}
function money(items, source) { return Number(items.reduce((n, x) => n + (x.monetary?.source === source ? (x.monetary.usd ?? 0) : 0), 0).toFixed(12)); }
export function missionCausalUsageAttribution(m) {
    const rows = [];
    for (const worker of m.execution.workers) {
        const groups = new Map();
        for (const item of worker.usage_observations ?? []) {
            const key = `g${item.generation}:a${item.attempt_ordinal}`;
            const group = groups.get(key) ?? [];
            group.push(item);
            groups.set(key, group);
        }
        const ordered = [...groups.values()].sort((a, b) => (a[0]?.generation ?? 0) - (b[0]?.generation ?? 0) || (a[0]?.attempt_ordinal ?? 0) - (b[0]?.attempt_ordinal ?? 0));
        let previousObservationID;
        for (const group of ordered) {
            if (!group.length)
                continue;
            const first = group[0], classified = causeForAttempt(m.execution.ledger, worker, first.attempt_ordinal, first.observation_id, previousObservationID), complete = group.filter(x => x.coverage === 'assistant-step-total'), basis = complete.length ? complete : group;
            const tokens = basis.reduce((a, x) => addTokenUsage(a, x.tokens), EMPTY_TOKEN_USAGE);
            rows.push({ worker_id: worker.id, task_id: worker.task_id, generation: first.generation, attempt_ordinal: first.attempt_ordinal, cause: classified.cause, lifecycle_attribution: classified.confidence, coverage: complete.length ? 'assistant-step-total' : 'assistant-message-reported', observation_ids: group.map(x => x.observation_id), tokens, total_tokens: total(tokens), context_tokens: context(tokens), derived_opencode_cost_usd: money(group, 'opencode-calculated'), provider_billed_cost_usd: money(group, 'provider-billed') });
            previousObservationID = group[group.length - 1]?.observation_id;
        }
    }
    const by_cause = {};
    for (const row of rows) {
        const current = by_cause[row.cause] ?? { observations: 0, attempts: 0, exact_complete_tokens: 0, exact_complete_context_tokens: 0, derived_opencode_cost_usd: 0, provider_billed_cost_usd: 0 };
        current.observations += row.observation_ids.length;
        current.attempts += 1;
        if (row.coverage === 'assistant-step-total') {
            current.exact_complete_tokens += row.total_tokens;
            current.exact_complete_context_tokens += row.context_tokens;
        }
        current.derived_opencode_cost_usd = Number((current.derived_opencode_cost_usd + row.derived_opencode_cost_usd).toFixed(12));
        current.provider_billed_cost_usd = Number((current.provider_billed_cost_usd + row.provider_billed_cost_usd).toFixed(12));
        by_cause[row.cause] = current;
    }
    const exact = rows.filter(r => r.coverage === 'assistant-step-total'), repeat = exact.filter(r => r.cause !== 'PRIMARY_EXECUTION');
    return { rows, by_cause, exact_complete_tokens: exact.reduce((n, r) => n + r.total_tokens, 0), exact_complete_context_tokens: exact.reduce((n, r) => n + r.context_tokens, 0), repeat_exact_tokens: repeat.reduce((n, r) => n + r.total_tokens, 0), repeat_exact_context_tokens: repeat.reduce((n, r) => n + r.context_tokens, 0), unattributed_repeat_exact_tokens: repeat.filter(r => r.lifecycle_attribution === 'unattributed').reduce((n, r) => n + r.total_tokens, 0), partial_observations: rows.filter(r => r.coverage !== 'assistant-step-total').reduce((n, r) => n + r.observation_ids.length, 0), basis: 'canonical-worker-attempt-usage+mission-ledger', cache_repayment: 'unavailable-without-per-turn-prefix-and-ttl-evidence', routing_authority: false };
}
