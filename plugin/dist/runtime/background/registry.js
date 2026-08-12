export class BackgroundRegistry {
    #workers = new Map();
    #spawn = new Map();
    list() { return [...this.#workers.values()]; }
    get(id) { return this.#workers.get(id); }
    set(w) { this.#workers.set(w.id, w); }
    delete(id) { this.#workers.delete(id); }
    pendingFor(parent) { return this.list().filter(w => w.parent_session_id === parent && ['created', 'queued', 'starting', 'busy'].includes(w.status)); }
    async dedupeSpawn(fingerprint, spawn) {
        const existing = this.#spawn.get(fingerprint);
        if (existing)
            return existing;
        const p = spawn().finally(() => this.#spawn.delete(fingerprint));
        this.#spawn.set(fingerprint, p);
        return p;
    }
}
