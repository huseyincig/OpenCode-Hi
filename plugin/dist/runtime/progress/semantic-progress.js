function sorted(values) { return [...new Set([...values].filter(Boolean))].sort(); }
function fnv(value) { let h = 2166136261; for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
} return (h >>> 0).toString(16).padStart(8, '0'); }
function taskFailureSignature(task) {
    const status = task.result?.status;
    if (!status || status === 'DONE')
        return [];
    const issues = sorted(task.result?.open_issues ?? []), needs = sorted(task.result?.needs_context ?? []);
    return [`task:${task.id}:${status}:${issues.join('|')}:${needs.join('|')}`];
}
function workerFailureSignature(worker) { return worker.last_runtime_failure_kind ? [`worker:${worker.id}:${worker.last_runtime_failure_kind}`] : []; }
/** Host-neutral semantic state fingerprint. Deliberately excludes prose summaries, timestamps and raw activity counts. */
export function semanticProgressSnapshot(m) {
    const dependencyIDs = new Set(m.execution.tasks.flatMap(task => task.dependencies));
    const evidenceIDs = sorted(m.execution.evidence.items.map(e => e.id));
    const invalidated = sorted(m.execution.evidence.items.filter(e => Boolean(e.invalidated_at)).map(e => e.id));
    const completedTasks = sorted(m.execution.tasks.filter(t => t.status === 'completed').map(t => t.id));
    const completedDependencies = sorted(m.execution.tasks.filter(t => t.status === 'completed' && dependencyIDs.has(t.id)).map(t => t.id));
    const closedObligations = sorted(m.execution.obligations.filter(o => o.status === 'closed').map(o => o.id));
    const changedFiles = sorted(m.vcs.changed_files);
    const failureSignatures = sorted([
        ...m.execution.blockers.map(x => `blocker:${x}`),
        ...m.execution.tasks.flatMap(taskFailureSignature),
        ...m.execution.workers.flatMap(workerFailureSignature),
    ]);
    const terminalProcesses = sorted(m.execution.processes.filter(p => p.status !== 'RUNNING').map(p => `${p.process_id}:${p.status}:${p.exit_code ?? ''}:${p.cleanup_state}`));
    const semanticState = {
        obligations: m.execution.obligations.map(o => [o.id, o.status]),
        tasks: m.execution.tasks.map(t => [t.id, t.status, t.result?.status, sorted(t.result?.open_issues ?? []), sorted(t.result?.needs_context ?? []), sorted(t.dependencies)]),
        workers: m.execution.workers.map(w => [w.id, w.status, w.model, w.model_variant, w.attempt ?? 0, w.runtime_recovery_attempt ?? 0, w.last_runtime_failure_kind]),
        processes: m.execution.processes.map(p => [p.process_id, p.status, p.cleanup_state, p.exit_code]),
        isolation: m.execution.isolation_decisions.map(d => [d.required, d.strategy, d.requested_by, sorted(d.scope)]),
        workspaces: m.execution.workspace_leases.map(w => [w.lease_id, w.status, w.cleanup_state, w.workspace_path]),
        evidence: m.execution.evidence.items.map(e => [e.id, e.kind, e.outcome, e.invalidated_at ? 1 : 0, e.task_id, sorted(e.obligation_ids ?? []), e.producer_attempt?.attempt_id, e.producer_attempt?.generation]),
        files: changedFiles,
        blockers: sorted(m.execution.blockers),
        constraints: sorted(m.execution.constraints),
        tasks_constraints: m.execution.tasks.map(t => [t.id, sorted(t.constraints)]),
        gates: m.execution.gates.map(g => [g.id, g.status, g.reason]),
        temporary: m.vcs.temporary_mutations.map(x => [x.id, x.status]),
        human_decision: m.authority.human_decision ? [m.authority.human_decision.decision_id, m.authority.human_decision.status, m.authority.human_decision.reason_code, m.authority.human_decision.resolved_at] : undefined,
        scheduler: m.execution.scheduler?.reservations.map(r => [r.reservationId, r.phase, r.attempt.attemptId, r.hostExecutionId]),
    };
    return { version: 1, state_hash: fnv(JSON.stringify(semanticState)), evidence_ids: evidenceIDs, invalidated_evidence_ids: invalidated, completed_task_ids: completedTasks, completed_dependency_ids: completedDependencies, closed_obligation_ids: closedObligations, changed_files: changedFiles, failure_signatures: failureSignatures, terminal_process_ids: terminalProcesses };
}
function added(previous, next) { const before = new Set(previous); return next.filter(x => !before.has(x)).length; }
function sameList(a, b) { return a.length === b.length && a.every((x, i) => x === b[i]); }
export function semanticProgressDelta(previous, next) {
    if (!previous)
        return { stateChanged: false, evidenceAdded: 0, evidenceInvalidated: 0, dependencyCompletions: 0, changedFiles: 0, failureSignatureChanged: false, executionAdvanced: false, signals: ['baseline-established'] };
    const evidenceAdded = added(previous.evidence_ids, next.evidence_ids);
    const evidenceInvalidated = added(previous.invalidated_evidence_ids, next.invalidated_evidence_ids);
    const dependencyCompletions = added(previous.completed_dependency_ids, next.completed_dependency_ids);
    const changedFiles = added(previous.changed_files, next.changed_files);
    const failureSignatureChanged = !sameList(previous.failure_signatures, next.failure_signatures);
    const obligationClosures = added(previous.closed_obligation_ids, next.closed_obligation_ids);
    const taskCompletions = added(previous.completed_task_ids, next.completed_task_ids);
    const processTerminals = added(previous.terminal_process_ids, next.terminal_process_ids);
    const executionAdvanced = obligationClosures > 0 || taskCompletions > 0 || processTerminals > 0;
    const signals = [];
    if (evidenceAdded)
        signals.push(`evidence-added:${evidenceAdded}`);
    if (evidenceInvalidated)
        signals.push(`evidence-invalidated:${evidenceInvalidated}`);
    if (dependencyCompletions)
        signals.push(`dependency-completed:${dependencyCompletions}`);
    if (changedFiles)
        signals.push(`changed-files:${changedFiles}`);
    if (failureSignatureChanged)
        signals.push('failure-signature-changed');
    if (obligationClosures)
        signals.push(`obligation-closed:${obligationClosures}`);
    if (taskCompletions)
        signals.push(`task-completed:${taskCompletions}`);
    if (processTerminals)
        signals.push(`process-terminal:${processTerminals}`);
    if (previous.state_hash !== next.state_hash && !signals.length)
        signals.push('state-changed-without-semantic-gain');
    return { stateChanged: previous.state_hash !== next.state_hash, evidenceAdded, evidenceInvalidated, dependencyCompletions, changedFiles, failureSignatureChanged, executionAdvanced, signals };
}
/** Positive progress or new diagnostic information; mere state churn/invalidation is not progress. */
export function semanticProgressMade(delta) { return delta.evidenceAdded > 0 || delta.dependencyCompletions > 0 || delta.changedFiles > 0 || delta.failureSignatureChanged || delta.executionAdvanced; }
function strings(v) { return Array.isArray(v) && v.every(x => typeof x === 'string'); }
export function isSemanticProgressSnapshot(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v))
        return false;
    const x = v, keys = ['version', 'state_hash', 'evidence_ids', 'invalidated_evidence_ids', 'completed_task_ids', 'completed_dependency_ids', 'closed_obligation_ids', 'changed_files', 'failure_signatures', 'terminal_process_ids'];
    if (Object.keys(x).some(k => !keys.includes(k)) || Object.keys(x).length !== keys.length || x.version !== 1 || typeof x.state_hash !== 'string' || !/^[a-f0-9]{8}$/.test(x.state_hash))
        return false;
    return ['evidence_ids', 'invalidated_evidence_ids', 'completed_task_ids', 'completed_dependency_ids', 'closed_obligation_ids', 'changed_files', 'failure_signatures', 'terminal_process_ids'].every(k => strings(x[k]));
}
export function isProgressDelta(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v))
        return false;
    const x = v, keys = ['stateChanged', 'evidenceAdded', 'evidenceInvalidated', 'dependencyCompletions', 'changedFiles', 'failureSignatureChanged', 'executionAdvanced', 'signals'];
    if (Object.keys(x).some(k => !keys.includes(k)) || Object.keys(x).length !== keys.length)
        return false;
    for (const k of ['stateChanged', 'failureSignatureChanged', 'executionAdvanced'])
        if (typeof x[k] !== 'boolean')
            return false;
    for (const k of ['evidenceAdded', 'evidenceInvalidated', 'dependencyCompletions', 'changedFiles'])
        if (!Number.isInteger(x[k]) || Number(x[k]) < 0)
            return false;
    return strings(x.signals);
}
