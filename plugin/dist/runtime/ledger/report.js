import { verificationEnvelopeFor } from '../verification/policy.js';
export function compactLedgerReport(m, limit = 40) {
    const events = m.execution.ledger.slice(-Math.max(1, Math.min(200, limit)));
    return {
        mission_id: m.identity.mission_id, status: m.identity.status, objective: m.identity.objective, risk: m.identity.risk, execution_mode: m.execution.execution_mode,
        verification_policy: m.execution.verification_policy,
        verification: verificationEnvelopeFor(m),
        obligations: m.execution.obligations.map(o => ({ id: o.id, kind: o.kind, status: o.status, summary: o.summary })),
        tasks: m.execution.tasks.map(t => ({ id: t.id, status: t.status, role: t.role, category: t.category, worker_id: t.worker_id, result: t.result?.status })),
        evidence: { fresh: m.execution.evidence.fresh, items: m.execution.evidence.items.filter(e => !e.invalidated_at).map(e => ({ id: e.id, kind: e.kind, summary: e.summary, outcome: e.outcome, pass: e.pass, scope: (e.scope ?? []).slice(0, 20), source: e.source })) },
        blockers: m.execution.blockers, stagnation_count: m.continuation.stagnation_count, iteration: m.continuation.iteration, continuation_budget: m.continuation.continuation_budget,
        events,
    };
}
