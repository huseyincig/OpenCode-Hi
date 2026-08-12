import { DEFAULT_HI_CONFIG } from './defaults.js';
import { HI_CONFIG_SCHEMA, isRecord } from './schema.js';
import { loadProjectRoutingConfig } from './routing-discovery.js';
function limits(raw) { if (!isRecord(raw))
    return {}; const out = {}; for (const [k, v] of Object.entries(raw))
    if (typeof v === 'number' && Number.isInteger(v) && v > 0)
        out[k] = Math.min(32, v); return out; }
function bounded(raw, fallback, min, max) { return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(min, Math.min(max, Math.floor(raw))) : fallback; }
function modelList(raw) { if (typeof raw === 'string')
    raw = [raw]; return Array.isArray(raw) ? [...new Set(raw.filter((x) => typeof x === 'string' && x.trim().length > 0).map(x => x.trim()))].slice(0, 8) : []; }
function roleModels(raw) { if (!isRecord(raw))
    return {}; const out = {}; for (const [k, v] of Object.entries(raw)) {
    const xs = modelList(v);
    if (xs.length)
        out[k] = xs;
} return out; }
function roleVariants(raw) { if (!isRecord(raw))
    return {}; const out = {}; for (const [role, v] of Object.entries(raw)) {
    if (!isRecord(v))
        continue;
    const inner = {};
    for (const [model, variant] of Object.entries(v))
        if (typeof variant === 'string' && variant.trim())
            inner[model] = variant.trim();
    if (Object.keys(inner).length)
        out[role] = inner;
} return out; }
function profileSettings(raw, fallback) { if (!isRecord(raw))
    return fallback; const out = { ...fallback }; for (const [k, v] of Object.entries(raw))
    out[k] = v; return out; }
function categoryModels(raw) { if (!isRecord(raw))
    return {}; const out = {}; for (const k of ['quick', 'standard', 'deep', 'visual', 'critical']) {
    const xs = modelList(raw[k]);
    if (xs.length)
        out[k] = xs;
} return out; }
function executionPolicy(raw) {
    const canonical = { minimal: 'minimal', balanced: 'balanced', thorough: 'thorough', adaptive: 'adaptive', manual: 'manual' };
    const key = typeof raw === 'string' ? raw : '';
    return canonical[key];
}
function profileBlock(raw) {
    if (!isRecord(raw))
        return undefined;
    const minimal = raw.minimal;
    const balanced = raw.balanced;
    const thorough = raw.thorough;
    return { minimal: profileSettings(minimal, DEFAULT_HI_CONFIG.profile.minimal), balanced: profileSettings(balanced, DEFAULT_HI_CONFIG.profile.balanced), thorough: profileSettings(thorough, DEFAULT_HI_CONFIG.profile.thorough) };
}
export function resolveHiConfigWithReport(raw, projectRoot) {
    const input = isRecord(raw) ? raw : {};
    const notes = [];
    const suppliedSchema = Number(input.schemaVersion ?? HI_CONFIG_SCHEMA);
    if (Number.isFinite(suppliedSchema) && suppliedSchema !== HI_CONFIG_SCHEMA)
        notes.push(`unsupported config schema ${suppliedSchema}; HI interpreted canonical fields only`);
    const fromProject = projectRoot ? loadProjectRoutingConfig(projectRoot) : undefined;
    if (fromProject && fromProject.routing)
        notes.push(`project routing override merged from .opencode/hi/policy/routing.json (${Object.keys(fromProject.routing.roleModels ?? {}).length} roles)`);
    const routing = isRecord(input.routing) ? input.routing : {};
    const projectRouting = isRecord(fromProject?.routing) ? fromProject.routing : {};
    const parallel = isRecord(fromProject?.parallel) ? fromProject.parallel : (isRecord(input.parallel) ? input.parallel : {});
    const teamMode = isRecord(fromProject?.teamMode) ? fromProject.teamMode : (isRecord(input.teamMode) ? input.teamMode : {});
    const compatibility = isRecord(input.compatibility) ? input.compatibility : {};
    const execution = isRecord(fromProject?.execution) ? fromProject.execution : (isRecord(input.execution) ? input.execution : {});
    const modelsCfg = isRecord(fromProject?.models) ? fromProject.models : (isRecord(input.models) ? input.models : {});
    const projectRM = fromProject?.routing?.roleModels ?? {};
    const projectRV = fromProject?.routing?.roleVariants ?? {};
    const projectCM = fromProject?.routing?.categoryModels ?? {};
    const projectCV = fromProject?.routing?.categoryVariants ?? {};
    const projectAllowed = fromProject?.routing?.allowedProviders;
    const projectDenied = fromProject?.routing?.deniedModels;
    const rawStrategy = routing.strategy;
    const projectStrategy = fromProject?.routing?.strategy;
    const strategy = (rawStrategy === 'quality' || rawStrategy === 'cost') ? rawStrategy : (projectStrategy === 'quality' || projectStrategy === 'cost') ? projectStrategy : 'cost-quality';
    const config = {
        schemaVersion: HI_CONFIG_SCHEMA,
        executionPolicy: executionPolicy(fromProject?.executionPolicy) ?? executionPolicy(input.executionPolicy) ?? 'adaptive',
        primaryMode: ['auto', 'working-manager', 'manager'].includes(fromProject?.primaryMode) ? fromProject.primaryMode : (['auto', 'working-manager', 'manager'].includes(input.primaryMode) ? input.primaryMode : 'auto'),
        compatibility: { mode: compatibility.mode === 'strict' ? 'strict' : 'compatible', validatedOpenCodeVersions: modelList(compatibility.validatedOpenCodeVersions) },
        execution: { topology: ['single-agent', 'multi-agent'].includes(String(execution.topology)) ? execution.topology : 'adaptive', maxAgents: bounded(execution.maxAgents, DEFAULT_HI_CONFIG.execution.maxAgents, 1, 8), parallelism: bounded(execution.parallelism, DEFAULT_HI_CONFIG.execution.parallelism, 1, 8), allowMultiRoleAgent: execution.allowMultiRoleAgent !== false },
        models: { mode: ['fixed', 'role-mapped'].includes(String(modelsCfg.mode)) ? modelsCfg.mode : 'adaptive', default: typeof modelsCfg.default === 'string' && modelsCfg.default.trim() ? modelsCfg.default.trim() : 'auto', roles: isRecord(modelsCfg.roles) ? Object.fromEntries(Object.entries(modelsCfg.roles).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, String(v).trim()])) : {} },
        routing: { strategy, categoryModels: { ...categoryModels(routing.categoryModels), ...categoryModels(projectCM) }, categoryVariants: { ...categoryModels(routing.categoryVariants), ...categoryModels(projectCV) }, roleModels: { ...roleModels(routing.roleModels), ...roleModels(projectRM) }, roleVariants: { ...roleVariants(routing.roleVariants), ...roleVariants(projectRV) }, modelPolicy: (fromProject?.routing?.modelPolicy ?? routing.modelPolicy) === 'manual' ? 'manual' : (fromProject?.routing?.modelPolicy ?? routing.modelPolicy) === 'recommended' ? 'recommended' : 'adaptive', adaptiveRoles: modelList(fromProject?.routing?.adaptiveRoles ?? routing.adaptiveRoles), maxFallbacks: bounded(projectRouting.maxFallbacks ?? routing.maxFallbacks, DEFAULT_HI_CONFIG.routing.maxFallbacks, 0, 6), allowedProviders: projectAllowed && projectAllowed.length ? projectAllowed : modelList(routing.allowedProviders), deniedModels: projectDenied && projectDenied.length ? projectDenied : modelList(routing.deniedModels) },
        parallel: { enabled: parallel.enabled !== false, max: bounded(parallel.max, DEFAULT_HI_CONFIG.parallel.max, 1, 8), providers: limits(parallel.providers), models: limits(parallel.models) },
        teamMode: { enabled: teamMode.enabled === true, auto: teamMode.auto === true, maxMembers: bounded(teamMode.maxMembers, 4, 2, 8), maxMessages: bounded(teamMode.maxMessages, 24, 1, 100), maxTurns: bounded(teamMode.maxTurns, 12, 1, 50), maxWallMinutes: bounded(teamMode.maxWallMinutes, 45, 1, 240) },
        profile: profileBlock(fromProject?.profile) ?? profileBlock(input.profile) ?? DEFAULT_HI_CONFIG.profile,
    };
    return { config, report: { schema: HI_CONFIG_SCHEMA, canonical: suppliedSchema === HI_CONFIG_SCHEMA, notes } };
}
export function resolveHiConfig(raw, projectRoot) { return resolveHiConfigWithReport(raw, projectRoot).config; }
