const DEFAULT_WINDOW = 12;
function retryCount(w) { return (w.fallback_history ?? []).filter(h => h.from === w.model || h.from === w.effective_model).length + (w.runtime_recovery_attempt ?? 0); }
function verificationOutcome(m, w) {
    const task = m.execution.tasks.find(t => t.id === w.task_id), evidence = task?.result?.evidence ?? [];
    if (evidence.some(e => e.outcome === 'failed' || e.pass === false))
        return 'failed';
    if (evidence.some(e => e.outcome === 'passed' || e.pass === true))
        return 'passed';
    return 'not-observed';
}
function confidence(samples) { return samples >= 8 ? 'high' : samples >= 4 ? 'medium' : samples >= 2 ? 'low' : 'insufficient'; }
export function missionModelFeedbackObservations(m, role, category, window = DEFAULT_WINDOW) {
    const eligible = m.execution.workers.filter(w => (!role || w.role === role) && (!category || w.category === category) && Boolean(w.effective_model ?? w.model) && ['completed', 'failed'].includes(w.status));
    return eligible.sort((a, b) => (b.completed_at ?? b.updated_at ?? 0) - (a.completed_at ?? a.updated_at ?? 0)).slice(0, Math.max(1, Math.min(32, window))).map(w => {
        const model = String(w.effective_model ?? w.model), started = w.started_at, completed = w.completed_at;
        return { model, role: w.role, category: w.category, success: w.status === 'completed', retry_count: retryCount(w), verification_outcome: verificationOutcome(m, w), ...(started && completed && completed >= started ? { latency_ms: completed - started } : {}), observed_at: completed ?? w.updated_at ?? m.identity.updated_at };
    });
}
export function deriveMissionModelFeedback(m, role, category, window = DEFAULT_WINDOW) {
    const observations = missionModelFeedbackObservations(m, role, category, window), failures = {}, successes = {}, retries = {}, samples = {}, average_latency_ms = {}, verification_passes = {}, verification_failures = {}, latencies = {};
    const inc = (r, id, n = 1) => r[id] = (r[id] ?? 0) + n;
    for (const o of observations) {
        inc(samples, o.model);
        inc(o.success ? successes : failures, o.model);
        if (o.retry_count)
            inc(retries, o.model, o.retry_count);
        if (o.verification_outcome === 'passed')
            inc(verification_passes, o.model);
        if (o.verification_outcome === 'failed')
            inc(verification_failures, o.model);
        if (o.latency_ms !== undefined)
            (latencies[o.model] ??= []).push(o.latency_ms);
    }
    for (const [model, xs] of Object.entries(latencies))
        average_latency_ms[model] = Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
    const models = new Set([...Object.keys(samples), ...Object.keys(retries)]);
    const confidence_by_model = Object.fromEntries([...models].map(model => [model, confidence((samples[model] ?? 0) + (retries[model] ?? 0))]));
    return { failures, successes, retries, samples, confidence: confidence_by_model, average_latency_ms, verification_passes, verification_failures, window_size: observations.length };
}
