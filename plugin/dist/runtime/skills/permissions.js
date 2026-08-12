function isRecord(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function isPermission(v) { return v === 'allow' || v === 'ask' || v === 'deny'; }
function wildcard(pattern, value) { const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'); return new RegExp(`^${escaped}$`).test(value); }
export function resolveSkillPermissionMap(config, agentId) {
    const toMap = (raw) => { const out = {}; if (!isRecord(raw))
        return out; for (const [k, v] of Object.entries(raw))
        if (isPermission(v))
            out[k] = v; return out; };
    const global = toMap(config?.permission?.skill);
    const agent = agentId ? toMap(config?.agent?.[agentId]?.permission?.skill) : {};
    const merged = { ...global, ...agent };
    return Object.keys(merged).length ? merged : undefined;
}
export function resolveSkillToolEnabled(config, agentId) { if (config?.tools?.skill === false)
    return false; if (agentId && config?.agent?.[agentId]?.tools?.skill === false)
    return false; return true; }
export function resolveSkillPermission(name, map) { if (!map)
    return 'allow'; if (map[name])
    return map[name]; const matches = Object.keys(map).filter(p => wildcard(p, name)).sort((a, b) => b.length - a.length); return matches.length ? map[matches[0]] : 'allow'; }
