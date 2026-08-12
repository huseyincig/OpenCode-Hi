const KEY = Symbol.for('oho.active-runtime-instances');
function registry() { const g = globalThis; if (!(g[KEY] instanceof Map))
    g[KEY] = new Map(); return g[KEY]; }
export function acquireHhcRuntimeInstance(projectKey) {
    const key = projectKey || 'unknown-project', r = registry(), existing = r.get(key);
    if (existing)
        throw new Error(`Duplicate OpenCode HHC Orchestrator runtime detected for ${key}; refusing double hook registration.`);
    const token = `hhc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    r.set(key, token);
    return { key, token, release: () => { if (r.get(key) === token)
            r.delete(key); } };
}
