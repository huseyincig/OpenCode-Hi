import { DEFAULT_HI_CONFIG } from './defaults.js';
import { HI_CONFIG_SCHEMA, isRecord } from './schema.js';
import { loadProjectRoutingConfig } from './routing-discovery.js';
function limits(raw) { if (!isRecord(raw))
    return {}; const out = {}; for (const [k, v] of Object.entries(raw))
    if (typeof v === 'number' && Number.isInteger(v) && v > 0)
        out[k] = Math.min(32, v); return out; }
function validNumber(raw) { return typeof raw === 'number' && Number.isFinite(raw); }
function bounded(raw, fallback, min, max) { return validNumber(raw) ? Math.max(min, Math.min(max, Math.floor(raw))) : fallback; }
function boundedLayer(high, low, fallback, min, max) { return validNumber(high) ? bounded(high, fallback, min, max) : validNumber(low) ? bounded(low, fallback, min, max) : fallback; }
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
function modelMap(raw) { if (!isRecord(raw))
    return {}; return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, String(v).trim()])); }
function threshold(value) { return value === 'low' || value === 'medium' || value === 'high' ? value : undefined; }
function categoryModels(raw) { if (!isRecord(raw))
    return {}; const out = {}; for (const k of ['quick', 'standard', 'deep', 'visual', 'critical']) {
    const xs = modelList(raw[k]);
    if (xs.length)
        out[k] = xs;
} return out; }
function executionPolicy(raw) { const canonical = { minimal: 'minimal', balanced: 'balanced', thorough: 'thorough', adaptive: 'adaptive', manual: 'manual' }; return canonical[typeof raw === 'string' ? raw : '']; }
function primaryMode(raw) { return ['auto', 'working-manager', 'manager'].includes(raw) ? raw : undefined; }
function routingStrategy(raw) { return raw === 'cost-quality' || raw === 'quality' || raw === 'cost' ? raw : undefined; }
function topology(raw) { return raw === 'adaptive' || raw === 'single-agent' || raw === 'multi-agent' ? raw : undefined; }
function modelMode(raw) { return raw === 'adaptive' || raw === 'fixed' || raw === 'role-mapped' ? raw : undefined; }
function stringValue(raw) { return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined; }
function booleanLayer(high, low, fallback) { return typeof high === 'boolean' ? high : typeof low === 'boolean' ? low : fallback; }
function profileLayer(low, high, fallback) {
    const l = isRecord(low) ? low : {}, h = isRecord(high) ? high : {};
    return { specialistThreshold: threshold(h.specialistThreshold) ?? threshold(l.specialistThreshold) ?? fallback.specialistThreshold, reviewThreshold: threshold(h.reviewThreshold) ?? threshold(l.reviewThreshold) ?? fallback.reviewThreshold };
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
    const hostRouting = isRecord(input.routing) ? input.routing : {}, projectRouting = isRecord(fromProject?.routing) ? fromProject.routing : {};
    const hostParallel = isRecord(input.parallel) ? input.parallel : {}, projectParallel = isRecord(fromProject?.parallel) ? fromProject.parallel : {};
    const compatibility = isRecord(input.compatibility) ? input.compatibility : {};
    const hostExecution = isRecord(input.execution) ? input.execution : {}, projectExecution = isRecord(fromProject?.execution) ? fromProject.execution : {};
    const hostModels = isRecord(input.models) ? input.models : {}, projectModels = isRecord(fromProject?.models) ? fromProject.models : {};
    const hostProfile = isRecord(input.profile) ? input.profile : {}, projectProfile = isRecord(fromProject?.profile) ? fromProject.profile : {};
    const hostAllowed = modelList(hostRouting.allowedProviders), projectAllowed = modelList(projectRouting.allowedProviders);
    const hostDenied = modelList(hostRouting.deniedModels), projectDenied = modelList(projectRouting.deniedModels);
    const allowedProviders = hostAllowed.length && projectAllowed.length ? hostAllowed.filter(x => projectAllowed.includes(x)) : projectAllowed.length ? projectAllowed : hostAllowed;
    const deniedModels = [...new Set([...hostDenied, ...projectDenied])];
    const config = {
        schemaVersion: HI_CONFIG_SCHEMA,
        executionPolicy: executionPolicy(fromProject?.executionPolicy) ?? executionPolicy(input.executionPolicy) ?? DEFAULT_HI_CONFIG.executionPolicy,
        primaryMode: primaryMode(fromProject?.primaryMode) ?? primaryMode(input.primaryMode) ?? DEFAULT_HI_CONFIG.primaryMode,
        compatibility: { mode: compatibility.mode === 'strict' ? 'strict' : DEFAULT_HI_CONFIG.compatibility.mode, validatedOpenCodeVersions: modelList(compatibility.validatedOpenCodeVersions) },
        execution: {
            topology: topology(projectExecution.topology) ?? topology(hostExecution.topology) ?? DEFAULT_HI_CONFIG.execution.topology,
            maxAgents: boundedLayer(projectExecution.maxAgents, hostExecution.maxAgents, DEFAULT_HI_CONFIG.execution.maxAgents, 1, 8),
            parallelism: boundedLayer(projectExecution.parallelism, hostExecution.parallelism, DEFAULT_HI_CONFIG.execution.parallelism, 1, 8),
        },
        models: {
            mode: modelMode(projectModels.mode) ?? modelMode(hostModels.mode) ?? DEFAULT_HI_CONFIG.models.mode,
            default: stringValue(projectModels.default) ?? stringValue(hostModels.default) ?? DEFAULT_HI_CONFIG.models.default,
            roles: { ...modelMap(hostModels.roles), ...modelMap(projectModels.roles) },
        },
        routing: {
            strategy: routingStrategy(projectRouting.strategy) ?? routingStrategy(hostRouting.strategy) ?? DEFAULT_HI_CONFIG.routing.strategy,
            categoryModels: { ...categoryModels(hostRouting.categoryModels), ...categoryModels(projectRouting.categoryModels) },
            categoryVariants: { ...categoryModels(hostRouting.categoryVariants), ...categoryModels(projectRouting.categoryVariants) },
            roleModels: { ...roleModels(hostRouting.roleModels), ...roleModels(projectRouting.roleModels) },
            roleVariants: { ...roleVariants(hostRouting.roleVariants), ...roleVariants(projectRouting.roleVariants) },
            maxFallbacks: boundedLayer(projectRouting.maxFallbacks, hostRouting.maxFallbacks, DEFAULT_HI_CONFIG.routing.maxFallbacks, 0, 6),
            allowedProviders, deniedModels,
        },
        parallel: {
            enabled: booleanLayer(projectParallel.enabled, hostParallel.enabled, DEFAULT_HI_CONFIG.parallel.enabled),
            max: boundedLayer(projectParallel.max, hostParallel.max, DEFAULT_HI_CONFIG.parallel.max, 1, 8),
            providers: { ...limits(hostParallel.providers), ...limits(projectParallel.providers) },
            models: { ...limits(hostParallel.models), ...limits(projectParallel.models) },
        },
        profile: {
            minimal: profileLayer(hostProfile.minimal, projectProfile.minimal, DEFAULT_HI_CONFIG.profile.minimal),
            balanced: profileLayer(hostProfile.balanced, projectProfile.balanced, DEFAULT_HI_CONFIG.profile.balanced),
            thorough: profileLayer(hostProfile.thorough, projectProfile.thorough, DEFAULT_HI_CONFIG.profile.thorough),
        },
    };
    return { config, report: { schema: HI_CONFIG_SCHEMA, canonical: suppliedSchema === HI_CONFIG_SCHEMA, notes } };
}
export function resolveHiConfig(raw, projectRoot) { return resolveHiConfigWithReport(raw, projectRoot).config; }
