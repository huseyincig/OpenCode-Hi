export class ConcurrencyScheduler {
    policy;
    #running = new Map();
    constructor(policy) {
        this.policy = policy;
    }
    canStart(id, provider, model) {
        const p = this.policy(), current = this.#running.get(id);
        if (current && current.provider === provider && current.model === model)
            return { ok: true, reason: 'already-acquired' };
        // Rebinding an existing worker (fallback/escalation) must re-check the target
        // provider/model capacity. Exclude only this worker's current slot.
        const all = [...this.#running.entries()].filter(([runningID]) => runningID !== id).map(([, slot]) => slot);
        if (all.length + (current ? 1 : 0) > p.global)
            return { ok: false, reason: 'global-capacity' };
        if (!current && all.length >= p.global)
            return { ok: false, reason: 'global-capacity' };
        if (provider) {
            const cap = p.providers?.[provider] ?? p.global;
            if (all.filter(x => x.provider === provider).length >= cap)
                return { ok: false, reason: `provider-capacity:${provider}` };
        }
        if (model) {
            const cap = p.models?.[model] ?? p.global;
            if (all.filter(x => x.model === model).length >= cap)
                return { ok: false, reason: `model-capacity:${model}` };
        }
        return { ok: true, reason: current ? 'rebind-capacity-available' : 'capacity-available' };
    }
    acquire(id, provider, model) { const c = this.canStart(id, provider, model); if (!c.ok)
        return false; this.#running.set(id, { provider, model }); return true; }
    release(id) { this.#running.delete(id); }
    running() { return this.#running.size; }
    policySnapshot() { const p = this.policy(); return { global: p.global, providers: { ...(p.providers ?? {}) }, models: { ...(p.models ?? {}) } }; }
    allocations() { return [...this.#running.entries()].map(([id, slot]) => ({ id, ...slot })); }
}
