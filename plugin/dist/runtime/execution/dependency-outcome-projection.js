import { executionAttemptIdentity } from '../../contracts/orchestration-core.js';
import { clipText } from '../context/budget.js';
const SHA256 = /^[a-f0-9]{64}$/i;
const MAX_SUMMARY_CHARS = 1200;
const MAX_CHANGED_FILES = 32;
export class DependencyOutcomeProjectionError extends Error {
    constructor(message) { super(message); this.name = 'DependencyOutcomeProjectionError'; }
}
/**
 * Project only direct completed dependency outcomes. This is execution context,
 * never canonical Evidence: worker evidence claims/findings are intentionally
 * excluded so dependency dataflow cannot certify verification or review.
 */
export function projectDirectDependencyOutcomes(m, task) {
    const ids = [...new Set(task.dependencies)].sort();
    return ids.map(taskID => {
        const dependency = m.execution.tasks.find(item => item.id === taskID);
        if (!dependency)
            throw new DependencyOutcomeProjectionError(`dependency ${taskID} is missing`);
        if (dependency.status !== 'completed' || dependency.result?.status !== 'DONE')
            throw new DependencyOutcomeProjectionError(`dependency ${taskID} is not a completed DONE result`);
        const workers = m.execution.workers.filter(item => item.task_id === taskID);
        if (workers.length !== 1)
            throw new DependencyOutcomeProjectionError(`dependency ${taskID} must bind exactly one worker, observed ${workers.length}`);
        const worker = workers[0];
        if (dependency.worker_id !== worker.id || worker.parent_mission_id !== m.identity.mission_id || worker.status !== 'completed')
            throw new DependencyOutcomeProjectionError(`dependency ${taskID} worker binding is not terminal/current-mission exact`);
        if (!Number.isInteger(worker.attempt) || worker.attempt < 1 || !Number.isInteger(worker.generation_at_spawn) || worker.generation_at_spawn < 1)
            throw new DependencyOutcomeProjectionError(`dependency ${taskID} attempt identity is invalid`);
        if (!worker.last_result_digest || !SHA256.test(worker.last_result_digest))
            throw new DependencyOutcomeProjectionError(`dependency ${taskID} accepted result digest is missing or invalid`);
        if (worker.native_state_hash !== undefined && !SHA256.test(worker.native_state_hash))
            throw new DependencyOutcomeProjectionError(`dependency ${taskID} source state hash is invalid`);
        const attempt = executionAttemptIdentity({ executionUnitId: `eu:${taskID}`, workerId: worker.id, ordinal: worker.attempt, generation: worker.generation_at_spawn });
        return {
            task_id: taskID,
            worker_id: worker.id,
            attempt_id: attempt.attemptId,
            run_id: attempt.runId,
            generation: attempt.generation,
            result_digest: worker.last_result_digest,
            result_status: 'DONE',
            summary: clipText(dependency.result.summary, MAX_SUMMARY_CHARS),
            changed_files: [...dependency.result.changed_files].slice(0, MAX_CHANGED_FILES),
            ...(worker.native_state_hash ? { source_state_hash: worker.native_state_hash } : {})
        };
    });
}
function renderPayload(items, detail) {
    const projected = items.map(item => detail === 'full' ? item : detail === 'summary' ? { ...item, changed_files: [] } : { task_id: item.task_id, worker_id: item.worker_id, attempt_id: item.attempt_id, run_id: item.run_id, generation: item.generation, result_digest: item.result_digest, result_status: item.result_status, ...(item.source_state_hash ? { source_state_hash: item.source_state_hash } : {}) });
    return `DIRECT DEPENDENCY OUTCOMES — NON-EVIDENCE\n${JSON.stringify({ kind: 'direct-dependency-outcomes', evidence_authority: false, items: projected })}`;
}
/** Render valid bounded JSON without ever truncating through an object. */
export function renderDirectDependencyOutcomeContext(items, maxChars = 5000) {
    if (!items.length)
        return undefined;
    if (!Number.isInteger(maxChars) || maxChars < 1)
        throw new DependencyOutcomeProjectionError('dependency outcome context budget must be a positive integer');
    for (const detail of ['full', 'summary', 'identity']) {
        const text = renderPayload(items, detail);
        if (text.length <= maxChars)
            return text;
    }
    throw new DependencyOutcomeProjectionError(`dependency outcome identity set exceeds bounded context budget (${maxChars} chars)`);
}
