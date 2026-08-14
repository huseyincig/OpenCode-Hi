import { humanDecisionId } from '../../contracts/human-decision.js';
import { appendLedger } from '../ledger/ledger.js';
export function openHumanDecision(m, input) {
    const scope = { mission_id: m.identity.mission_id, task_id: input.task_id, worker_id: input.worker_id };
    const decisionId = humanDecisionId({ semantic_type: input.semantic_type, reason_code: input.reason_code, blocking_scope: scope, authority_ref: input.authority_ref });
    const previous = m.authority.human_decision, createdAt = previous?.status === 'OPEN' && previous.decision_id === decisionId ? previous.created_at : Date.now();
    const decision = { decision_id: decisionId, semantic_type: input.semantic_type, reason_code: input.reason_code, summary: input.summary.slice(0, 800), blocking_scope: scope, response_schema: structuredClone(input.response_schema), authority_ref: input.authority_ref, status: 'OPEN', created_at: createdAt };
    m.authority.human_decision = decision;
    m.identity.status = 'waiting-user';
    if (previous?.status !== 'OPEN' || previous.decision_id !== decisionId)
        appendLedger(m, 'user.action.required', { task_id: input.task_id, worker_id: input.worker_id, payload: { decision_id: decision.decision_id, semantic_type: decision.semantic_type, reason_code: decision.reason_code, response_kind: decision.response_schema.kind, authority_ref: decision.authority_ref } });
    return decision;
}
export function resolveHumanDecision(m, resolution, at = Date.now()) {
    const current = m.authority.human_decision;
    if (!current || current.status !== 'OPEN')
        return current;
    const resolved = { ...current, status: 'RESOLVED', resolved_at: at, resolution: resolution.slice(0, 240) || 'resolved' };
    m.authority.human_decision = resolved;
    appendLedger(m, 'user.action.resolved', { task_id: resolved.blocking_scope.task_id, worker_id: resolved.blocking_scope.worker_id, payload: { decision_id: resolved.decision_id, semantic_type: resolved.semantic_type, reason_code: resolved.reason_code, resolution: resolved.resolution } });
    return resolved;
}
export function classifyRuntimeHumanDecision(reasonCode) {
    if (reasonCode === 'waiting-user-authority' || reasonCode.startsWith('authority'))
        return { semantic_type: 'authority_request', response_schema: { kind: 'authority-protocol', protocol: 'approve-exact-action' } };
    if (reasonCode.includes('permission'))
        return { semantic_type: 'operational_action', response_schema: { kind: 'external-action' } };
    if (reasonCode.includes('provider') || reasonCode.includes('runtime') || reasonCode.includes('budget') || reasonCode.includes('precondition') || reasonCode.includes('rollback'))
        return { semantic_type: 'operational_action', response_schema: { kind: 'external-action' } };
    return { semantic_type: 'value_judgment', response_schema: { kind: 'free-text' } };
}
