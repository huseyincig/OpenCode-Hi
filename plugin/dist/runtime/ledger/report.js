import { verificationEnvelopeFor } from '../verification/policy.js';
export function compactLedgerReport(m, limit = 40) {
    const events = m.ledger.slice(-Math.max(1, Math.min(200, limit)));
    return {
        mission_id: m.mission_id, status: m.status, objective: m.objective, risk: m.risk, execution_mode: m.execution_mode,
        verification_policy: m.verification_policy,
        verification: verificationEnvelopeFor(m),
        obligations: m.obligations.map(o => ({ id: o.id, kind: o.kind, status: o.status, summary: o.summary })),
        tasks: m.tasks.map(t => ({ id: t.id, status: t.status, role: t.role, category: t.category, worker_id: t.worker_id, result: t.result?.status })),
        evidence: { fresh: m.evidence.fresh, items: m.evidence.items.filter(e => !e.invalidated_at).map(e => ({ kind: e.kind, summary: e.summary, pass: e.pass, source: e.source })) },
        blockers: m.blockers, stagnation_count: m.stagnation_count, iteration: m.iteration, continuation_budget: m.continuation_budget,
        events,
    };
}
