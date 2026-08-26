const TERMINAL_WORKER = new Set(['completed', 'failed', 'cancelled']);
const TERMINAL_TASK = new Set(['completed', 'failed', 'cancelled', 'blocked']);
export function resolveBrowserExecutionOwner(mission, input) {
    if (mission.identity.status !== 'active' || mission.continuation.user_interrupted)
        return undefined;
    const worker = mission.execution.workers.find(candidate => candidate.session_id === input.sessionID &&
        (input.workerID === undefined || candidate.id === input.workerID) &&
        (input.taskID === undefined || candidate.task_id === input.taskID));
    if (!worker)
        return undefined;
    if (worker.parent_session_id !== mission.identity.session_id || worker.parent_mission_id !== mission.identity.mission_id)
        return undefined;
    if (worker.generation_at_spawn !== mission.continuation.generation || worker.restart_reconcile_pending)
        return undefined;
    if (worker.role !== 'visual-qa' || TERMINAL_WORKER.has(worker.status))
        return undefined;
    const task = mission.execution.tasks.find(candidate => candidate.id === worker.task_id);
    if (!task || task.mission_id !== mission.identity.mission_id || task.worker_id !== worker.id || task.role !== 'visual-qa' || TERMINAL_TASK.has(task.status) || task.execution_profile?.browser_backend !== 'bounded-playwright')
        return undefined;
    return { worker, task };
}
