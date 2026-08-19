import { clipText } from './budget.js';
import { syncMissionGates } from '../gates/gates.js';
import { userMissionStatus } from '../ledger/status.js';
function currentWorker(m, worker) { return worker ?? m.execution.workers.find(w => ['created', 'queued', 'starting', 'busy', 'ready'].includes(w.status)); }
function compactList(items, limit) { return [...new Set(items.filter(Boolean))].slice(0, limit); }
function methodologySummary(m, worker) {
    if (worker)
        return compactList(worker.selected_methodologies ?? [], 8);
    return compactList(m.methodology.parent_loaded_methodologies ?? [], 8);
}
function nextAction(m, worker) {
    if (m.continuation.pending_nudge?.instruction)
        return clipText(m.continuation.pending_nudge.instruction, 600);
    const openDecision = m.authority.human_decision?.status === 'OPEN' ? m.authority.human_decision : undefined;
    if (openDecision)
        return `user-action:${openDecision.semantic_type}:${openDecision.reason_code}`;
    if (m.authority.pending_permissions > 0 || m.authority.authority?.pending || m.authority.authority?.executing)
        return 'user-action:authority-or-native-permission';
    if (!worker && m.execution.execution_mode === 'parallel' && m.execution.tasks.length === 0)
        return 'delegate:parallel-work-via-hi_task_start';
    if (!worker && m.methodology.methodology_needs.length) {
        const need = m.methodology.methodology_needs[0];
        return `methodology:${need.name}:${clipText(need.reason, 260)}`;
    }
    const s = userMissionStatus(m);
    return worker && ['busy', 'starting', 'queued'].includes(worker.status) ? `wait:${worker.id}:${worker.status}` : s.next_action;
}
function blockerSummary(m) {
    const gates = syncMissionGates(m).filter(g => g.status !== 'closed').map(g => `gate:${g.id}:${g.status}:${g.reason ?? g.summary}`);
    return compactList([...m.execution.blockers, ...gates], 8).map(x => clipText(x, 320));
}
function executionSummary(m, worker) {
    const topology = m.execution.topology;
    const ownership = worker ? `worker:${worker.id}` : m.execution.execution_mode === 'parallel' ? 'parent-delegation-only' : 'parent-direct-allowed';
    return `mode=${m.execution.execution_mode}; topology=${topology?.mode ?? 'single-agent'}; parallelism=${topology?.parallelism ?? 1}; ownership=${ownership}`;
}
function verificationSummary(m) {
    const required = m.execution.verification_policy.requiredKinds.join(',') || 'none';
    const review = m.execution.verification_policy.requireReview ? 'independent-review-required' : 'no-independent-review-required';
    return `evidence=${m.execution.evidence.fresh ? 'fresh' : 'stale'}; required=${required}; ${review}`;
}
function authoritySummary(m) {
    const human = m.authority.human_decision?.status === 'OPEN' ? `${m.authority.human_decision.semantic_type}:${m.authority.human_decision.reason_code}` : 'none';
    const action = m.authority.authority?.executing ? 'executing' : m.authority.authority?.pending ? 'pending' : 'none';
    return `permissions=${m.authority.pending_permissions}; human=${human}; action=${action}`;
}
function changedFileSummary(m) {
    const changed = compactList(m.vcs.changed_files.slice(-30), 30).join(',') || 'none';
    const userOwned = compactList(Object.keys(m.vcs.preexisting_user_changes ?? {}), 20).join(',') || 'none';
    return `changed=${changed}; preexisting-user-owned=${userOwned}`;
}
function taskWorkerSummary(m, worker) {
    const current = currentWorker(m, worker);
    if (current) {
        const task = m.execution.tasks.find(t => t.id === current.task_id);
        return `task=${task?.id ?? current.task_id}:${task?.status ?? 'unknown'}:${clipText(task?.objective ?? '', 360)}; worker=${current.id}:${current.role}:${current.status}:${current.model ?? 'host-default'}`;
    }
    const activeTasks = m.execution.tasks.filter(t => !['completed', 'failed', 'cancelled'].includes(t.status)).slice(0, 4).map(t => `${t.id}:${t.status}:${clipText(t.objective, 160)}`);
    const activeWorkers = m.execution.workers.filter(w => !['completed', 'failed', 'cancelled'].includes(w.status)).slice(0, 4).map(w => `${w.id}:${w.role}:${w.status}`);
    return `tasks=${activeTasks.join('|') || 'none'}; workers=${activeWorkers.join('|') || 'none'}`;
}
export function buildMissionRuntimeProjection(m, worker) {
    const constraints = m.execution.constraints.slice(-6).map(x => clipText(x, 260));
    const objective = clipText(`${m.identity.objective}${constraints.length ? ` | constraints: ${constraints.join(' | ')}` : ''}`, 1200);
    return {
        objective,
        next_action: nextAction(m, worker),
        execution: executionSummary(m, worker),
        blockers: blockerSummary(m),
        obligations: m.execution.obligations.filter(o => o.status === 'open').slice(0, 8).map(o => `id=${o.id}; summary=${clipText(o.summary, 300)}`),
        active_methodologies: methodologySummary(m, worker),
        verification: verificationSummary(m),
        authority: authoritySummary(m),
        changed_files: changedFileSummary(m),
        task_worker: taskWorkerSummary(m, worker),
    };
}
export function renderMissionRuntimeProjection(p) {
    return [
        'Hi MISSION RUNTIME PROJECTION',
        `Objective: ${p.objective}`,
        `Next action: ${p.next_action}`,
        `Execution: ${p.execution}`,
        `Blockers: ${p.blockers.join(' | ') || 'none'}`,
        `Obligations: ${p.obligations.join(' | ') || 'none'}`,
        `Active methodologies: ${p.active_methodologies.join(', ') || 'none'}`,
        `Verification: ${p.verification}`,
        `Authority: ${p.authority}`,
        `Changed-file state: ${p.changed_files}`,
        `Current task/worker: ${p.task_worker}`,
    ].join('\n');
}
export function measureMissionRuntimeProjection(projection) { const dynamic = renderMissionRuntimeProjection(projection); return { dynamic_chars: dynamic.length }; }
