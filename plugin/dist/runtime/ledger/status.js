export function userMissionStatus(m) {
    const active = m.execution.workers.filter(w => ['created', 'queued', 'starting', 'busy'].includes(w.status)).length;
    const open = m.execution.obligations.filter(o => o.status === 'open').length;
    let next = 'continue';
    if (m.identity.status === 'waiting-user' || m.authority.pending_permissions > 0 || m.authority.authority?.pending || m.authority.authority?.executing)
        next = 'user-action';
    else if (active > 0)
        next = 'wait';
    else if (open === 0 && m.execution.evidence.fresh && !m.execution.blockers.length)
        next = 'complete';
    else if (!m.execution.evidence.fresh && m.execution.verification_policy.requiredKinds.length)
        next = 'verify';
    else if (m.execution.blockers.length || m.continuation.stagnation_count > 0)
        next = 'recover';
    const human = m.authority.human_decision?.status === 'OPEN' ? { type: m.authority.human_decision.semantic_type, reason_code: m.authority.human_decision.reason_code } : undefined;
    return { status: m.identity.status, active_workers: active, open_obligations: open, evidence: m.execution.evidence.fresh ? 'fresh' : 'stale', blockers: m.execution.blockers.length, next_action: next, human_decision: human };
}
export function formatUserMissionStatus(m) {
    const s = userMissionStatus(m);
    return `Hi: ${s.status} · ${s.active_workers} worker active · ${s.open_obligations} obligation open · evidence ${s.evidence} · next ${s.next_action}${s.human_decision ? ` · human ${s.human_decision.type}:${s.human_decision.reason_code}` : ''}`;
}
