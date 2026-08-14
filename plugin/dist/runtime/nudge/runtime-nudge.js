export function setRuntimeNudge(m, instruction, reason, task_id, worker_id) { const n = { id: `n_${Date.now().toString(36)}`, reason, instruction, created_at: Date.now(), generation: m.continuation.generation, task_id, worker_id }; m.continuation.pending_nudge = n; return n; }
export function consumeRuntimeNudge(m) { const n = m.continuation.pending_nudge; if (n && n.generation === m.continuation.generation)
    m.continuation.pending_nudge = undefined; return n?.generation === m.continuation.generation ? n : undefined; }
