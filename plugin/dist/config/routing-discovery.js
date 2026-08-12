import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
export function loadProjectRoutingConfig(projectRoot) {
    if (!projectRoot)
        return undefined;
    const path = join(projectRoot, '.opencode', 'hi', 'policy', 'routing.json');
    if (!existsSync(path))
        return undefined;
    let raw;
    try {
        raw = JSON.parse(readFileSync(path, 'utf8'));
    }
    catch {
        return undefined;
    }
    if (raw?.schema !== 1 || raw?.type !== 'hi-routing')
        return undefined;
    const r = raw?.routing && typeof raw.routing === 'object' ? raw.routing : {};
    const roleModels = {};
    if (r.roleModels && typeof r.roleModels === 'object') {
        for (const [k, v] of Object.entries(r.roleModels)) {
            if (Array.isArray(v))
                roleModels[k] = v.filter(x => typeof x === 'string');
        }
    }
    const roleVariants = {};
    if (r.roleVariants && typeof r.roleVariants === 'object') {
        for (const [role, value] of Object.entries(r.roleVariants)) {
            if (!value || typeof value !== 'object' || Array.isArray(value))
                continue;
            const variants = {};
            for (const [model, variant] of Object.entries(value))
                if (typeof variant === 'string' && variant.trim())
                    variants[model] = variant.trim();
            if (Object.keys(variants).length)
                roleVariants[role] = variants;
        }
    }
    const categoryModels = {};
    if (r.categoryModels && typeof r.categoryModels === 'object') {
        for (const [k, v] of Object.entries(r.categoryModels)) {
            if (Array.isArray(v))
                categoryModels[k] = v.filter(x => typeof x === 'string');
        }
    }
    const categoryVariants = {};
    if (r.categoryVariants && typeof r.categoryVariants === 'object') {
        for (const [k, v] of Object.entries(r.categoryVariants)) {
            if (Array.isArray(v))
                categoryVariants[k] = v.filter(x => typeof x === 'string');
        }
    }
    const out = {
        routing: {
            strategy: r.strategy ?? 'cost-quality',
            roleModels,
            roleVariants,
            modelPolicy: r.modelPolicy === 'recommended' || r.modelPolicy === 'manual' ? 'recommended' === r.modelPolicy ? 'recommended' : 'manual' : 'adaptive',
            adaptiveRoles: Array.isArray(r.adaptiveRoles) ? r.adaptiveRoles.filter(x => typeof x === 'string') : [],
            categoryModels,
            categoryVariants,
            allowedProviders: Array.isArray(r.allowedProviders) ? r.allowedProviders.filter(x => typeof x === 'string') : [],
            deniedModels: Array.isArray(r.deniedModels) ? r.deniedModels.filter(x => typeof x === 'string') : [],
            ...(typeof r.maxFallbacks === 'number' && Number.isFinite(r.maxFallbacks) ? { maxFallbacks: Math.max(0, Math.min(6, Math.floor(r.maxFallbacks))) } : {}),
        },
    };
    const executionPolicyMap = { minimal: 'minimal', balanced: 'balanced', thorough: 'thorough', adaptive: 'adaptive', manual: 'manual' };
    const executionPolicy = executionPolicyMap[String(raw.executionPolicy)];
    if (executionPolicy)
        out.executionPolicy = executionPolicy;
    if (['auto', 'working-manager', 'manager'].includes(String(raw.primaryMode)))
        out.primaryMode = raw.primaryMode;
    if (raw.execution && typeof raw.execution === 'object')
        out.execution = raw.execution;
    if (raw.models && typeof raw.models === 'object')
        out.models = raw.models;
    if (raw.parallel && typeof raw.parallel === 'object')
        out.parallel = raw.parallel;
    if (raw.teamMode && typeof raw.teamMode === 'object')
        out.teamMode = raw.teamMode;
    if (raw.profile && typeof raw.profile === 'object')
        out.profile = raw.profile;
    return out;
}
