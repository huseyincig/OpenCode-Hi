import { appendLedger } from '../ledger/ledger.js';
import { syncMissionGates } from '../gates/gates.js';
import { addEvidence } from '../evidence/evidence-runtime.js';
const TERMINAL_STATIC_PRECONDITIONS = new Set([
    'native-child-session', 'native-child-prompt', 'runtime-model', 'methodology-resource',
    'agent-definition', 'agent-mode', 'tool-read', 'tool-edit', 'recursive-delegation',
]);
const CAPABILITY_PREFIXES = ['capability-precondition:', 'capability-unavailable:'];
export function isTerminalCapabilityPrecondition(id) { return TERMINAL_STATIC_PRECONDITIONS.has(id); }
export function isCapabilityBlocker(value) { return CAPABILITY_PREFIXES.some(prefix => value.startsWith(prefix)); }
export function firstCapabilityBlocker(m) { return m.execution.blockers.find(isCapabilityBlocker); }
/**
 * Bind static host/runtime preflight failures into durable mission state. The markers are scoped by
 * role and reconciled on every new preflight for that same role, so a real config/provider/resource
 * change clears the old marker instead of requiring manual state surgery.
 */
export function reconcileTaskCapabilityPreconditions(m, role, result) {
    const prefix = `capability-precondition:${role}:`, current = result.items.filter(item => item.decision === 'RESOLVE' && isTerminalCapabilityPrecondition(item.id)).map(item => `${prefix}${item.id}`);
    const before = new Set(m.execution.blockers), keep = m.execution.blockers.filter(item => !item.startsWith(prefix) || current.includes(item));
    m.execution.blockers = [...new Set([...keep, ...current])];
    const after = new Set(m.execution.blockers), added = [...after].filter(x => !before.has(x) && x.startsWith(prefix)), cleared = [...before].filter(x => !after.has(x) && x.startsWith(prefix));
    if (added.length || cleared.length)
        appendLedger(m, 'capability.precondition-reconciled', { payload: { role, added, cleared, preconditions: result.items.filter(x => x.decision !== 'READY').map(x => ({ id: x.id, decision: x.decision, reason: x.reason })).slice(0, 16) } });
    syncMissionGates(m);
    return current;
}
export function markCapabilityUnavailable(m, input) {
    const capability = input.capability.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'unknown', marker = `capability-unavailable:${capability}`;
    if (!m.execution.blockers.includes(marker)) {
        m.execution.blockers.push(marker);
        appendLedger(m, 'capability.unavailable', { task_id: input.taskId, worker_id: input.workerId, payload: { capability, reason: input.reason.slice(0, 600), marker } });
    }
    syncMissionGates(m);
    return marker;
}
export function markVerificationCapabilityUnavailable(m, input) {
    const marker = markCapabilityUnavailable(m, input), verificationObligations = new Set(m.execution.obligations.filter(o => o.kind === 'verification').map(o => o.id)), obligationIds = [...new Set(input.obligationIds.filter(id => verificationObligations.has(id)))];
    for (const kind of [...new Set(input.requiredKinds)]) {
        const duplicate = m.execution.evidence.items.some(e => !e.invalidated_at && e.kind === kind && e.outcome === 'environment-issue' && e.reason === marker && obligationIds.every(id => (e.obligation_ids ?? []).includes(id)));
        if (!duplicate)
            addEvidence(m, { kind, summary: `Required verification capability unavailable: ${input.capability}`.slice(0, 1000), scope: [...new Set(m.vcs.changed_files)], source: 'runtime:capability-preflight', task_id: input.taskId, obligation_ids: obligationIds, outcome: 'environment-issue', reason: marker });
    }
    return marker;
}
export function clearCapabilityUnavailable(m, capability) {
    const key = capability.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'unknown', marker = `capability-unavailable:${key}`, before = m.execution.blockers.length;
    m.execution.blockers = m.execution.blockers.filter(x => x !== marker);
    if (m.execution.blockers.length !== before) {
        appendLedger(m, 'capability.available', { payload: { capability: key, marker } });
        syncMissionGates(m);
        return true;
    }
    return false;
}
const SESSION_ABORT_OWNER_PREFIXES = [
    'behavioral-recovery-abort-unavailable:',
    'stagnation-recovery-abort-unavailable:',
    'runtime-fallback-recovery-abort-unavailable:',
    'parallel-conflict-abort-unavailable:',
    'parallel-conflict-resume-abort-unavailable:',
    'semantic-abort-unavailable:',
    'constraint-abort-unavailable:',
    'constraint-rebase-recovery-abort-unavailable:',
];
function sessionAbortOwner(value) { const prefix = SESSION_ABORT_OWNER_PREFIXES.find(item => value.startsWith(item)); if (!prefix)
    return undefined; const rest = value.slice(prefix.length), split = rest.lastIndexOf(':'); if (split <= 0 || split === rest.length - 1)
    return undefined; return { taskId: rest.slice(0, split), workerId: rest.slice(split + 1) }; }
export function reconcileSessionAbortQuiescenceDemand(m) {
    const retired = [];
    m.execution.blockers = m.execution.blockers.filter(blocker => { const owner = sessionAbortOwner(blocker); if (!owner)
        return true; const worker = m.execution.workers.find(item => item.id === owner.workerId && item.task_id === owner.taskId), stillHostOwned = Boolean(worker?.session_id && (worker.restart_reconcile_pending === true || ['starting', 'busy'].includes(worker.status) || m.execution.scheduler?.reservations.some(item => item.workerId === worker.id))); if (stillHostOwned)
        return true; retired.push(blocker); return false; });
    const global = 'capability-unavailable:session-abort', hasGlobal = m.execution.blockers.includes(global), hostBoundInflight = m.execution.workers.some(worker => Boolean(worker.session_id && (worker.restart_reconcile_pending === true || ['starting', 'busy'].includes(worker.status) || m.execution.scheduler?.reservations.some(item => item.workerId === worker.id)))), ownerBlocker = m.execution.blockers.some(blocker => Boolean(sessionAbortOwner(blocker))), globalRetired = hasGlobal && !hostBoundInflight && !ownerBlocker;
    if (globalRetired)
        m.execution.blockers = m.execution.blockers.filter(blocker => blocker !== global);
    if (retired.length || globalRetired) {
        appendLedger(m, 'capability.quiescence-demand-reconciled', { payload: { capability: 'session-abort', retired: retired.slice(0, 30), global_blocker_retired: globalRetired, reason: 'no-active-host-quiescence-owner' } });
        syncMissionGates(m);
    }
    return { retired, globalRetired };
}
