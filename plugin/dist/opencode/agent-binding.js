function record(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined; }
function canonical(value) {
    if (Array.isArray(value))
        return value.map(canonical);
    const r = record(value);
    if (!r)
        return value;
    return Object.fromEntries(Object.keys(r).sort().map(k => [k, canonical(r[k])]));
}
function same(a, b) { return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)); }
const HI_INJECTED_AGENTS = new WeakSet();
export function isHiInjectedOpenCodeAgent(value) { return Boolean(value && typeof value === 'object' && HI_INJECTED_AGENTS.has(value)); }
const DECISION_RANK = { deny: 0, ask: 1, allow: 2 };
function decision(value) { return typeof value === 'string' && value in DECISION_RANK ? value : undefined; }
function leavesAtMost(value, max) { const d = decision(value); if (d)
    return DECISION_RANK[d] <= DECISION_RANK[max]; const r = record(value); if (!r)
    return false; return Object.values(r).every(v => leavesAtMost(v, max)); }
function permissionCompatible(actual, expected, path = []) {
    const ed = decision(expected), ad = decision(actual);
    if (ed) {
        if (ad)
            return DECISION_RANK[ad] <= DECISION_RANK[ed];
        return leavesAtMost(actual, ed);
    }
    const e = record(expected);
    if (!e)
        return same(actual, expected);
    if (ad)
        return ad === 'deny'; // a blanket deny is always a safe narrowing
    const a = record(actual);
    if (!a)
        return false;
    const wildcard = decision(e['*']);
    for (const [key, value] of Object.entries(e)) {
        if (key === '*') {
            const candidate = a[key] ?? a['*'];
            if (candidate === undefined || !permissionCompatible(candidate, value, [...path, key]))
                return false;
            continue;
        }
        const candidate = a[key] ?? a['*'];
        if (candidate === undefined || !permissionCompatible(candidate, value, [...path, key]))
            return false;
    }
    for (const [key, value] of Object.entries(a)) {
        if (key in e)
            continue;
        if (path.at(-1) === 'skill' && key.startsWith('hi-project-') && decision(value))
            continue;
        if (wildcard) {
            if (!permissionCompatible(value, wildcard, [...path, key]))
                return false;
            continue;
        }
        if (!leavesAtMost(value, 'deny'))
            return false;
    }
    return true;
}
/**
 * Compatibility check for a pre-existing host agent occupying a canonical Hi name.
 * Hi execution-critical semantics remain fixed, while harmless display metadata and
 * permission narrowings are allowed. Permission widening or host-level model/tool
 * constraints are collisions because they can invalidate Hi routing/authority semantics.
 */
export function matchesHiOpenCodeAgent(actual, expected) {
    const a = record(actual), e = record(expected);
    if (!a || !e)
        return false;
    if (a.mode !== e.mode || a.prompt !== e.prompt)
        return false;
    if (typeof e.steps === 'number') {
        if (typeof a.steps !== 'number' || !Number.isFinite(a.steps) || a.steps < 1 || a.steps > e.steps)
            return false;
    }
    else if (a.steps !== undefined && !same(a.steps, e.steps))
        return false;
    if (!permissionCompatible(a.permission, e.permission, ['permission']))
        return false;
    for (const [key, value] of Object.entries(e)) {
        if (['permission', 'mode', 'prompt', 'steps', 'description'].includes(key))
            continue;
        if (!same(a[key], value))
            return false;
    }
    const harmless = new Set(['description', 'hidden', 'color']);
    for (const key of Object.keys(a)) {
        if (key in e || harmless.has(key))
            continue;
        // Agent-level routing/tool/disable/options changes are not treated as metadata.
        return false;
    }
    return true;
}
export function projectHiOpenCodeAgents(hostConfig, packaged) {
    const existing = record(hostConfig.agent), agents = existing ?? {}, collisions = [], inserted = [], compatibleExisting = [];
    for (const [name, definition] of Object.entries(packaged))
        if (agents[name] !== undefined) {
            if (matchesHiOpenCodeAgent(agents[name], definition))
                compatibleExisting.push(name);
            else
                collisions.push(name);
        }
    if (collisions.length)
        return { collisions: collisions.sort(), inserted: [], compatibleExisting: compatibleExisting.sort() };
    for (const [name, definition] of Object.entries(packaged))
        if (agents[name] === undefined) {
            agents[name] = structuredClone(definition);
            if (agents[name] && typeof agents[name] === 'object')
                HI_INJECTED_AGENTS.add(agents[name]);
            inserted.push(name);
        }
    if (!existing && inserted.length)
        hostConfig.agent = agents;
    return { collisions: [], inserted: inserted.sort(), compatibleExisting: compatibleExisting.sort() };
}
/** Backward-compatible helper retained for narrow callers/tests. */
export function bindHiOpenCodeAgents(hostConfig, packaged) { return projectHiOpenCodeAgents(hostConfig, packaged).collisions; }
