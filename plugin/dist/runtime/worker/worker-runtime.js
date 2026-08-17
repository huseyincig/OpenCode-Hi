import { bindContextReference } from '../../contracts/context-reference.js';
import { appendLedger } from '../ledger/ledger.js';
function uid(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }
function canon(items = []) { return [...new Set(items.map(x => x.trim().replace(/\\/g, '/').replace(/\/+$/, '')).filter(Boolean))].sort().join(','); }
export function workerFingerprint(role, category, model, taskFamily, objective = '', contract) { return [role, category, model ?? 'default', taskFamily, objective.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 240), `scope:${canon(contract?.scope)}`, `constraints:${canon(contract?.constraints)}`, `deps:${canon(contract?.dependencies)}`, `evidence:${canon(contract?.requiredEvidence)}`, `obligations:${canon(contract?.obligationIds)}`].join('|'); }
export function createTask(m, input) { const now = Date.now(), id = uid('t'), task = { id, mission_id: m.identity.mission_id, objective: input.objective, status: 'created', role: input.role, category: input.category, scope: input.scope ?? [], constraints: input.constraints ?? [], dependencies: input.dependencies ?? [], requiredEvidence: input.requiredEvidence ?? [], obligation_ids: [...new Set(input.obligationIds ?? [])], context_artifacts: (input.contextReferences ?? []).map(ref => bindContextReference(ref, id)), execution_profile: input.executionProfile, gate_ids: [], external_action_requirements: [...m.identity.intent.requestedExternalActions], created_at: now, updated_at: now }; m.execution.tasks.push(task); appendLedger(m, 'task.created', { task_id: task.id, payload: { role: task.role, category: task.category, dependencies: task.dependencies, obligation_ids: task.obligation_ids } }); return task; }
export function createWorker(m, task, model, fallbacks = [], selectedMethodologies = [], methodologyProvenanceItems = []) { const now = Date.now(), w = { id: uid('w'), task_id: task.id, role: task.role, category: task.category, parent_session_id: m.identity.session_id, parent_mission_id: m.identity.mission_id, model, fallbacks, selected_methodologies: selectedMethodologies, loaded_methodologies: [], methodologies: methodologyProvenanceItems, fingerprint: workerFingerprint(task.role, task.category, model, m.identity.intent.taskKind, task.objective, { scope: task.scope, constraints: task.constraints, dependencies: task.dependencies, requiredEvidence: task.requiredEvidence, obligationIds: task.obligation_ids }), status: 'created', attempt: 0, generation_at_spawn: m.continuation.generation, updated_at: now }; m.execution.workers.push(w); task.worker_id = w.id; appendLedger(m, 'worker.created', { task_id: task.id, worker_id: w.id, payload: { model, selected_methodologies: selectedMethodologies, generation: m.continuation.generation, mission_id: m.identity.mission_id, methodologies: methodologyProvenanceItems.map(x => ({ name: x.name, provider: x.provider, permission: x.permission, injection: x.injection, sha256: x.source_sha256 })) } }); return w; }
export function beginWorkerAttempt(task, worker, at = Date.now()) { worker.attempt = (worker.attempt ?? 0) + 1; worker.started_at = at; worker.updated_at = at; task.updated_at = at; }
export function applyWorkerResult(m, task, worker, result) { task.result = result; task.updated_at = Date.now(); worker.completed_at = task.updated_at; worker.updated_at = task.updated_at; if (result.status === 'DONE') {
    task.status = 'completed';
    worker.status = 'completed';
}
else if (result.status === 'BLOCKED' || result.status === 'NEEDS_CONTEXT') {
    task.status = 'blocked';
    worker.status = 'ready';
}
else if (result.status === 'FIX_REQUIRED') {
    task.status = 'waiting';
    worker.status = 'ready';
}
else {
    task.status = 'failed';
    worker.status = 'failed';
} m.vcs.changed_files = [...new Set([...m.vcs.changed_files, ...result.changed_files])]; if (result.status !== 'DONE')
    m.execution.blockers = [...new Set([...m.execution.blockers, ...result.open_issues])]; appendLedger(m, 'worker.completed', { task_id: task.id, worker_id: worker.id, payload: { status: result.status, changed_files: result.changed_files } }); }
