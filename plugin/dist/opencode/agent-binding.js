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
/**
 * OpenCode adapter binding check for one canonical Hi role template.
 * The only tolerated host-side extension is an admitted project methodology
 * permission (`hi-project-*`) in the native skill permission map.
 */
export function matchesHiOpenCodeAgent(actual, expected) {
    const a = record(actual), e = record(expected);
    if (!a || !e)
        return false;
    const aPermission = record(a.permission), ePermission = record(e.permission);
    if (!aPermission || !ePermission)
        return false;
    const aSkill = record(aPermission.skill) ?? {}, eSkill = record(ePermission.skill) ?? {};
    for (const [name, value] of Object.entries(eSkill))
        if (!same(aSkill[name], value))
            return false;
    for (const name of Object.keys(aSkill))
        if (!(name in eSkill) && !name.startsWith('hi-project-'))
            return false;
    const strip = (x) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'skill'));
    if (!same(strip(aPermission), strip(ePermission)))
        return false;
    const stripPermission = (x) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'permission'));
    return same(stripPermission(a), stripPermission(e));
}
export function bindHiOpenCodeAgents(hostConfig, packaged) {
    const agents = record(hostConfig.agent) ?? {};
    const collisions = [];
    for (const [name, definition] of Object.entries(packaged)) {
        if (agents[name] === undefined)
            agents[name] = JSON.parse(JSON.stringify(definition));
        else if (!matchesHiOpenCodeAgent(agents[name], definition))
            collisions.push(name);
    }
    hostConfig.agent = agents;
    return collisions.sort();
}
