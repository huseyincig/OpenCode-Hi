import { isHiReadOnlyChildRole } from '../roles/catalog.js';
import { evaluateSchedulingSurfaceConflicts } from './planner.js';
/**
 * Compatibility projection for older benchmark/test consumers.
 * Canonical mutable-surface policy lives in planner.evaluateSchedulingSurfaceConflicts;
 * this helper must never grow independent scheduling semantics again.
 */
export function parallelSafety(existing, candidate) {
    const active = existing.filter(task => ['created', 'queued', 'running', 'waiting'].includes(task.status));
    const dependencyBlockers = active.filter(task => candidate.dependencies.includes(task.id)).map(task => `dependency:${task.id}`);
    const candidateSurface = { executionUnitId: 'compat:candidate', missionId: 'compat', workNodeId: 'compat:candidate', status: 'created', scope: [...candidate.scope], writeSet: [], readOnly: isHiReadOnlyChildRole(candidate.role ?? ''), createdAt: Number.MAX_SAFE_INTEGER };
    const peers = active.filter(task => !candidate.dependencies.includes(task.id)).map(task => ({ executionUnitId: `eu:${task.id}`, missionId: 'compat', workNodeId: task.id, status: task.status, scope: [...task.scope], writeSet: [], readOnly: isHiReadOnlyChildRole(task.role), createdAt: task.created_at }));
    const conflict = evaluateSchedulingSurfaceConflicts(candidateSurface, peers);
    const reasons = [...dependencyBlockers, ...conflict.reasons.map(item => item.code === 'mutable-surface-conflict' ? `write-scope-overlap:${item.detail ?? ''}` : `${item.code}${item.detail ? `:${item.detail}` : ''}`)];
    return { safe: reasons.length === 0, reasons };
}
