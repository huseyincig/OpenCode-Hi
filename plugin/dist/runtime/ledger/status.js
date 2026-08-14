export function userMissionStatus(m) {
    const active = m.workers.filter(w => ['created', 'queued', 'starting', 'busy'].includes(w.status)).length;
    const open = m.obligations.filter(o => o.status === 'open').length;
    let next = 'continue';
    if (m.status === 'waiting-user' || m.pending_permissions > 0 || m.authority?.pending || m.authority?.executing)
        next = 'user-action';
    else if (active > 0)
        next = 'wait';
    else if (open === 0 && m.evidence.fresh && !m.blockers.length)
        next = 'complete';
    else if (!m.evidence.fresh && m.verification_policy.requiredKinds.length)
        next = 'verify';
    else if (m.blockers.length || m.stagnation_count > 0)
        next = 'recover';
    const human = m.human_decision?.status === 'OPEN' ? { type: m.human_decision.semantic_type, reason_code: m.human_decision.reason_code } : undefined;
    return { status: m.status, active_workers: active, open_obligations: open, evidence: m.evidence.fresh ? 'fresh' : 'stale', blockers: m.blockers.length, next_action: next, human_decision: human };
}
export function formatUserMissionStatus(m) {
    const s = userMissionStatus(m);
    return `Hi: ${s.status} · ${s.active_workers} worker active · ${s.open_obligations} obligation open · evidence ${s.evidence} · next ${s.next_action}${s.human_decision ? ` · human ${s.human_decision.type}:${s.human_decision.reason_code}` : ''}`;
}
