export function setRuntimeNudge(m, instruction, reason, task_id, worker_id) { const n = { id: `n_${Date.now().toString(36)}`, reason, instruction, created_at: Date.now(), generation: m.generation, task_id, worker_id }; m.pending_nudge = n; return n; }
export function consumeRuntimeNudge(m) { const n = m.pending_nudge; if (n && n.generation === m.generation)
    m.pending_nudge = undefined; return n?.generation === m.generation ? n : undefined; }
