import { clipList, clipText, DEFAULT_CONTEXT_BUDGET } from '../context/budget.js';
function rowList(values, maxChars, maxItems) {
    return clipList(values, maxChars, maxItems).join(' | ') || 'none';
}
export function boundMissionSurvivalSections(sections, maxChars = DEFAULT_CONTEXT_BUDGET.max_context_chars) { return clipText(sections.join('\n'), maxChars); }
/**
 * Compaction survival state is intentionally priority-preserving rather than a
 * transcript summary. Every section is independently bounded so a large task
 * or obligation list cannot push blockers / next-safe-action / STOP conditions
 * out of the host compaction context.
 */
export function compactMissionContext(m, worker) {
    const open = m.execution.obligations.filter(o => o.status !== 'closed');
    const active = m.execution.workers.filter(w => !['completed', 'failed', 'cancelled'].includes(w.status));
    const latest = [...m.execution.evidence.items].sort((a, b) => b.observed_at - a.observed_at).slice(0, 8);
    const gates = m.execution.gates.filter(g => g.status !== 'closed');
    const artifacts = m.context.context_artifacts.slice(-DEFAULT_CONTEXT_BUDGET.max_artifacts);
    const rollbacks = m.vcs.temporary_mutations.filter(x => x.status !== 'rolled-back');
    const unreconciled = m.execution.tasks.filter(t => t.result && ['FIX_REQUIRED', 'NEEDS_CONTEXT', 'BLOCKED'].includes(t.result.status));
    const nextSafe = clipText(m.continuation.pending_nudge?.instruction ?? m.continuation.continuation_reason ?? 'evaluate open obligations', 1200);
    const blockers = rowList(m.execution.blockers.map(clip => clipText(clip, 500)), 2200, 12);
    const essential = [
        'Hi MISSION SURVIVAL STATE',
        `MISSION OBJECTIVE: ${clipText(m.identity.objective, 2200)}`,
        `STATUS: ${m.identity.status}`,
        `GENERATION: ${m.continuation.generation}`,
        `RISK: ${m.identity.risk}`,
        `AMBIGUITY: ${m.identity.intent.ambiguity}`,
        `DEPENDENCY CLASS: ${m.identity.intent.dependencyClass}`,
        `KNOWN BLOCKERS: ${blockers}`,
        `NEXT SAFE ACTION: ${nextSafe}`,
        'STOP CONDITIONS: all required obligations closed; no pending tasks/workers or unreconciled child result; required evidence fresh; no authority/rollback gate pending',
        `USER INTERRUPTED: ${String(m.continuation.user_interrupted)}`,
    ];
    const boundedState = [
        `UNRECONCILED RESULTS: ${rowList(unreconciled.map(t => `${t.id}:${t.result?.status}:${clipText(t.result?.summary, 350)}`), 1600, 8)}`,
        `OPEN GATES: ${rowList(gates.map(g => `${g.id}:${g.status}:${clipText(g.reason ?? g.summary, 400)}`), 1800, 8)}`,
        `TEMP ROLLBACKS: ${rowList(rollbacks.map(x => `${x.id}:${x.status}:${clipText(x.description, 400)}`), 1400, 6)}`,
        `ACTIVE/PENDING WORKERS: ${rowList(active.map(w => `${w.id}:${w.status}:${w.role}:g${w.generation_at_spawn ?? '?'}`), 1800, 12)}`,
        `ACTIVE OBLIGATIONS: ${rowList(open.map(o => `${o.id}:${o.status}:${clipText(o.summary, 500)}`), 2600, 12)}`,
        `CURRENT TASKS: ${rowList(m.execution.tasks.map(t => `${t.id}:${t.status}:${clipText(t.objective, 420)}`), 3000, 14)}`,
        `LATEST RELEVANT EVIDENCE: ${rowList(latest.map(e => `${e.kind}:${e.outcome ?? e.pass}:${e.invalidated_at ? 'stale' : 'fresh'}:${e.source_session_id ?? e.source ?? 'unknown'}:${clipText(e.summary, 420)}`), 2600, 8)}`,
        `CONTEXT ARTIFACTS: ${rowList(artifacts.map(a => `${a.kind}:${clipText(a.title ?? a.id, 300)}:${a.sha256 ?? ''}`), 1500, DEFAULT_CONTEXT_BUDGET.max_artifacts)}`,
        ...(worker ? [`CURRENT CHILD: ${worker.id}:${worker.role}; session=${worker.session_id ?? 'none'}; forked_from=${worker.forked_from_session_id ?? 'none'}; methodologies=${rowList(worker.methodologies.map(x => `${x.name}@${x.source_sha256?.slice(0, 12) ?? 'nohash'}`), 900, 3)}`] : []),
        'Do not create duplicate tasks or restart planning unless runtime state requires it.',
    ];
    return boundMissionSurvivalSections([...essential, ...boundedState]);
}
