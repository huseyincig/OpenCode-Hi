// Auto-init: when `.opencode/oho-routing.json` is missing in the
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
import { join } from 'node:path';
export const DEFAULT_ROLE_MODELS_OPENCODE_GO = {
    'working-manager': ['opencode-go/minimax-m3'],
    manager: ['opencode-go/minimax-m3-high', 'opencode-go/minimax-m3'],
    coder: ['opencode-go/deepseek-v4-pro'],
    'security-reviewer': ['opencode-go/glm-5.2'],
    'qa-reviewer': ['opencode-go/qwen3.7-plus'],
    architect: ['opencode-go/glm-5.2'],
    'visual-qa': ['opencode-go/mimo-v2.5'],
    'repository-explorer': ['opencode-go/deepseek-v4-flash'],
};
export const DEFAULT_STRATEGY = 'quality';
export function defaultProjectRoutingConfig(availableModelIDs) {
    return {
        schema: 1,
        type: 'oho-routing',
        routing: {
            strategy: DEFAULT_STRATEGY,
            modelPolicy: 'recommended',
            roleModels: Object.fromEntries(Object.entries(DEFAULT_ROLE_MODELS_OPENCODE_GO).map(([role, ids]) => [role, availableModelIDs !== undefined ? ids.filter(id => availableModelIDs.includes(id)) : [...ids]]).filter(([, ids]) => ids.length > 0)),
            roleVariants: {},
            smartSelectRoles: availableModelIDs === undefined ? [] : Object.entries(DEFAULT_ROLE_MODELS_OPENCODE_GO).filter(([, ids]) => !ids.some(id => availableModelIDs.includes(id))).map(([role]) => role),
        },
        applied_at: Date.now(),
        applied_by: 'opencode-hhc-orchestrator',
    };
}
export function ensureProjectRoutingConfig(projectRoot, availableModelIDs) {
    const path = join(projectRoot, '.opencode', 'oho-routing.json');
    if (existsSync(path)) {
        try {
            const current = JSON.parse(readFileSync(path, 'utf8'));
            if (current?.schema === 1 && current?.type === 'oho-routing' && current.routing && typeof current.routing === 'object')
                return { created: false, path };
            if (current?.schema === 1 && current?.type === 'oho-routing') {
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
    mkdirSync(join(projectRoot, '.opencode'), { recursive: true });
    writeFileSync(path, JSON.stringify(next, null, 2) + '\n', 'utf8');
    return { created: true, path, configuredRoles, reason: availableModelIDs !== undefined ? 'inventory-validated-recommended-models' : 'offline-defaults' };
}
