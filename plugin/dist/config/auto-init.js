// Project-local persistence for explicit Hi child-role model preferences.
//
// Automatic model recommendations are deliberately ephemeral in 0.2.4. This
// module has no inventory/bootstrap writer: only an explicit user `set`/`clear`
// operation may mutate `.opencode/hi/policy/routing.json`.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { MODEL_ROUTED_CHILD_ROLES } from './schema.js';
import { dirname, join } from 'node:path';
function normalizeRoleModels(input) {
    const out = {};
    for (const role of MODEL_ROUTED_CHILD_ROLES) {
        const ids = [...new Set(input[role] ?? [])].map(String).map(x => x.trim()).filter(Boolean);
        if (ids.length)
            out[role] = ids;
    }
    return out;
}
export function setProjectRoleModels(projectRoot, role, models) {
    const path = join(projectRoot, '.opencode', 'hi', 'policy', 'routing.json');
    let current = { schema: 1, type: 'hi-routing', routing: {} };
    if (existsSync(path)) {
        try {
            const parsed = JSON.parse(readFileSync(path, 'utf8'));
            if (parsed?.schema === 1 && parsed?.type === 'hi-routing' && parsed.routing && typeof parsed.routing === 'object' && !Array.isArray(parsed.routing))
                current = parsed;
            else
                throw new Error('unsupported routing shape');
        }
        catch (error) {
            throw new Error(`Cannot update Hi role routing: ${String(error)}`);
        }
    }
    const routing = { ...(current.routing ?? {}) }, existing = routing.roleModels && typeof routing.roleModels === 'object' && !Array.isArray(routing.roleModels) ? routing.roleModels : {}, roleModels = { ...existing };
    const normalized = [...new Set(models.map(String).map(x => x.trim()).filter(Boolean))];
    if (normalized.length)
        roleModels[role] = normalized;
    else
        delete roleModels[role];
    const automaticRoles = new Set(Array.isArray(routing.adaptiveRoles) ? routing.adaptiveRoles.map(String) : []);
    if (normalized.length)
        automaticRoles.delete(role);
    else
        automaticRoles.add(role);
    const next = { ...current, schema: 1, type: 'hi-routing', routing: { ...routing, modelPolicy: 'manual', roleModels, adaptiveRoles: [...automaticRoles].map(String).filter(x => MODEL_ROUTED_CHILD_ROLES.includes(x)) }, applied_at: Date.now(), applied_by: 'opencode-hi' };
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n', 'utf8');
    renameSync(tmp, path);
    return { path, roleModels: normalizeRoleModels(roleModels) };
}
