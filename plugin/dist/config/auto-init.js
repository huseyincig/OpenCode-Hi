// Auto-init: when `.opencode/hi/policy/routing.json` is missing in the
// project root, write a sensible default based on the opencode-go
// provider family. This makes per-role model routing work out of
// the box without the user having to run
// `native_plugin_setup.py role-models --defaults` first.
//
// The default is opencode-go-aware but not vendor-locking: the
// runtime's model-resolver only treats these as preferred, not as
// hard requirements. If the opencode-go provider is not in the
// runtime inventory, scoring fallback still applies. The defaults
// are written to disk only when no file exists, so user overrides
// are preserved across runs.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { MODEL_ROUTED_CHILD_ROLES } from './schema.js';
import { dirname, join } from 'node:path';
export const DEFAULT_ROLE_MODELS_OPENCODE_GO = {
    coder: ['opencode-go/deepseek-v4-flash', 'opencode-go/mimo-v2.5', 'opencode-go/qwen3.7-plus', 'opencode-go/mimo-v2.5-pro'],
    'security-reviewer': ['opencode-go/mimo-v2.5-pro', 'opencode-go/qwen3.6-plus', 'opencode-go/hy3'],
    'qa-reviewer': ['opencode-go/hy3', 'opencode-go/qwen3.6-plus', 'opencode-go/mimo-v2.5-pro'],
    architect: ['opencode-go/qwen3.7-plus', 'opencode-go/minimax-m2.7', 'opencode-go/mimo-v2.5-pro'],
    'visual-qa': ['opencode-go/hy3', 'opencode-go/mimo-v2.5', 'opencode-go/qwen3.6-plus'],
    'repository-explorer': ['opencode-go/mimo-v2.5', 'opencode-go/deepseek-v4-flash', 'opencode-go/qwen3.7-plus'],
};
for (const role of Object.keys(DEFAULT_ROLE_MODELS_OPENCODE_GO))
    if (!MODEL_ROUTED_CHILD_ROLES.includes(role))
        throw new Error(`Non-child role in model defaults: ${role}`);
export const DEFAULT_STRATEGY = 'cost-quality';
export function defaultProjectRoutingConfig(availableModelIDs) {
    return {
        schema: 1,
        type: 'hi-routing',
        routing: {
            strategy: DEFAULT_STRATEGY,
            modelPolicy: 'recommended',
            roleModels: Object.fromEntries(Object.entries(DEFAULT_ROLE_MODELS_OPENCODE_GO).map(([role, ids]) => [role, availableModelIDs !== undefined ? ids.filter(id => availableModelIDs.includes(id)) : [...ids]]).filter(([, ids]) => ids.length > 0)),
            roleVariants: {},
            adaptiveRoles: availableModelIDs === undefined ? [] : Object.entries(DEFAULT_ROLE_MODELS_OPENCODE_GO).filter(([, ids]) => !ids.some(id => availableModelIDs.includes(id))).map(([role]) => role),
        },
        applied_at: Date.now(),
        applied_by: 'opencode-hi',
    };
}
export function ensureProjectRoutingConfig(projectRoot, availableModelIDs) {
    const path = join(projectRoot, '.opencode', 'hi', 'policy', 'routing.json');
    if (existsSync(path)) {
        try {
            const current = JSON.parse(readFileSync(path, 'utf8'));
            if (current?.schema === 1 && current?.type === 'hi-routing' && current.routing && typeof current.routing === 'object')
                return { created: false, path };
            if (current?.schema === 1 && current?.type === 'hi-routing') {
                const next = defaultProjectRoutingConfig(availableModelIDs), configuredRoles = Object.keys(next.routing.roleModels).length;
                if (availableModelIDs !== undefined && configuredRoles === 0)
                    return { created: false, path, configuredRoles: 0, reason: 'runtime-inventory-has-no-curated-recommended-models' };
                current.routing = next.routing;
                current.applied_at = next.applied_at;
                current.applied_by = next.applied_by;
                writeFileSync(path, JSON.stringify(current, null, 2) + '\n', 'utf8');
                return { created: true, path, configuredRoles, reason: availableModelIDs !== undefined ? 'inventory-validated-recommended-models-merged-with-project-settings' : 'offline-defaults-merged-with-project-settings' };
            }
        }
        catch { }
        return { created: false, path };
    }
    const next = defaultProjectRoutingConfig(availableModelIDs);
    const configuredRoles = Object.keys(next.routing.roleModels).length;
    if (availableModelIDs !== undefined && configuredRoles === 0)
        return { created: false, path, configuredRoles: 0, reason: 'runtime-inventory-has-no-curated-recommended-models' };
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(next, null, 2) + '\n', 'utf8');
    return { created: true, path, configuredRoles, reason: availableModelIDs !== undefined ? 'inventory-validated-recommended-models' : 'offline-defaults' };
}
