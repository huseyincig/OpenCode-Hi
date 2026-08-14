const KEY = Symbol.for('hi.active-runtime-instances');
function registry() { const g = globalThis; const existing = g[KEY]; if (existing?.legacy instanceof Map && existing?.byOwner instanceof WeakMap)
    return existing; const next = { legacy: new Map(), byOwner: new WeakMap() }; g[KEY] = next; return next; }
export function acquireHiRuntimeInstance(projectKey, owner) {
    const key = projectKey || 'unknown-project', r = registry(), bucket = owner ? (r.byOwner.get(owner) ?? new Map()) : r.legacy;
    if (owner && !r.byOwner.has(owner))
        r.byOwner.set(owner, bucket);
    const existing = bucket.get(key);
    if (existing)
        throw new Error(`Duplicate OpenCode-Hi runtime detected for ${key}; refusing double hook registration.`);
    const token = `hi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    bucket.set(key, token);
    return { key, token, release: () => { if (bucket.get(key) === token)
            bucket.delete(key); } };
}
