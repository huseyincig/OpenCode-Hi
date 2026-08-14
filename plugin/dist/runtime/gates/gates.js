import { verificationSatisfied } from '../verification/policy.js';
function upsert(m, id, kind, summary, status, reason) { const now = Date.now(); const existing = m.execution.gates.find(g => g.id === id); if (existing) {
    existing.kind = kind;
    existing.summary = summary;
    existing.status = status;
    existing.reason = reason;
    existing.updated_at = now;
}
else
    m.execution.gates.push({ id, kind, summary, status, reason, updated_at: now }); }
export function syncMissionGates(m) {
    m.execution.gates ??= [];
    const semanticPending = m.identity.semantic_assessment?.status !== 'assessed';
    upsert(m, 'gate-semantic-assessment', 'precondition', 'Natural-language intent must be normalized into the host-agnostic Hi semantic contract before execution', semanticPending ? 'blocked' : 'closed', semanticPending ? 'semantic-assessment-pending' : undefined);
    const authorityOpen = m.execution.obligations.some(o => o.kind === 'authority' && o.status !== 'closed') || Boolean(m.authority.authority?.pending || m.authority.authority?.executing);
    upsert(m, 'gate-authority', 'user-authority', 'Privileged external effect requires exact authority and confirmed completion', authorityOpen ? (m.authority.authority?.approved ? 'ready' : 'blocked') : 'closed', authorityOpen ? 'authority-open' : undefined);
    const verifyOpen = m.execution.obligations.some(o => o.kind === 'verification' && o.status !== 'closed');
    const verify = verificationSatisfied(m);
    upsert(m, 'gate-verification', 'verification', 'Required verification evidence must be fresh and policy-complete', verifyOpen ? (verify.ok ? 'ready' : 'open') : 'closed', verifyOpen && !verify.ok ? verify.missing.join(',') : undefined);
    const ambiguity = m.identity.intent.ambiguity === 'contract-critical' && m.execution.obligations.some(o => o.kind === 'implementation' && o.status === 'open');
    upsert(m, 'gate-contract-ambiguity', 'precondition', 'Contract-critical ambiguity must be resolved from repo/evidence before implementation', ambiguity ? 'blocked' : 'closed', ambiguity ? 'contract-critical-ambiguity' : undefined);
    const reviewOpen = m.execution.obligations.some(o => o.kind === 'review' && o.status !== 'closed'), independentReviewOpen = m.execution.verification_policy.requireReview && reviewOpen;
    upsert(m, 'gate-reviewer', 'reviewer', 'Required independent review must be completed', independentReviewOpen ? 'open' : 'closed', independentReviewOpen ? 'review-obligation-open' : undefined);
    const prereq = m.execution.tasks.filter(t => t.dependencies.some(id => m.execution.tasks.find(x => x.id === id)?.status !== 'completed') && !['completed', 'failed', 'cancelled'].includes(t.status));
    upsert(m, 'gate-prerequisites', 'prerequisite-task', 'Task prerequisites must complete before dependent worker dispatch', prereq.length ? 'open' : 'closed', prereq.length ? `waiting:${prereq.map(t => t.id).join(',')}` : undefined);
    const rollbackOpen = (m.vcs.temporary_mutations ?? []).some(x => x.status === 'active' || x.status === 'failed');
    upsert(m, 'gate-temporary-rollback', 'rollback', 'Temporary execution mutations must be deterministically rolled back', rollbackOpen ? 'blocked' : 'closed', rollbackOpen ? 'temporary-mutation-open' : undefined);
    return m.execution.gates;
}
