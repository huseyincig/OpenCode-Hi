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
    const routing = {};
    if (r.strategy === 'cost-quality' || r.strategy === 'quality' || r.strategy === 'cost')
        routing.strategy = r.strategy;
    if (r.roleModels && typeof r.roleModels === 'object') {
        const roleModels = {};
        for (const [k, v] of Object.entries(r.roleModels))
            if (Array.isArray(v)) {
                const xs = v.filter((x) => typeof x === 'string' && x.trim().length > 0).map(x => x.trim());
                if (xs.length)
                    roleModels[k] = xs;
            }
        if (Object.keys(roleModels).length)
            routing.roleModels = roleModels;
    }
    if (r.roleVariants && typeof r.roleVariants === 'object') {
        const roleVariants = {};
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
        if (Object.keys(roleVariants).length)
            routing.roleVariants = roleVariants;
    }
    for (const key of ['categoryModels', 'categoryVariants']) {
        const source = r[key];
        if (source && typeof source === 'object' && !Array.isArray(source)) {
            const mapped = {};
            for (const [k, v] of Object.entries(source))
                if (Array.isArray(v)) {
                    const xs = v.filter((x) => typeof x === 'string' && x.trim().length > 0).map(x => x.trim());
                    if (xs.length)
                        mapped[k] = xs;
                }
            if (Object.keys(mapped).length)
                routing[key] = mapped;
        }
    }
    for (const key of ['allowedProviders', 'deniedModels'])
        if (Array.isArray(r[key])) {
            const xs = r[key].filter((x) => typeof x === 'string' && x.trim().length > 0).map(x => x.trim());
            routing[key] = [...new Set(xs)].slice(0, 8);
        }
    if (typeof r.maxFallbacks === 'number' && Number.isFinite(r.maxFallbacks))
        routing.maxFallbacks = Math.max(0, Math.min(6, Math.floor(r.maxFallbacks)));
    const out = {};
    if (Object.keys(routing).length)
        out.routing = routing;
    const executionPolicyMap = { minimal: 'minimal', balanced: 'balanced', thorough: 'thorough', adaptive: 'adaptive', manual: 'manual' };
    const executionPolicy = executionPolicyMap[String(raw.executionPolicy)];
    if (executionPolicy)
        out.executionPolicy = executionPolicy;
    if (['auto', 'working-manager', 'manager'].includes(String(raw.primaryMode)))
        out.primaryMode = raw.primaryMode;
    const bounded = (value, min, max) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : undefined;
    if (raw.execution && typeof raw.execution === 'object' && !Array.isArray(raw.execution)) {
        const e = {};
        if (['adaptive', 'single-agent', 'multi-agent'].includes(String(raw.execution.topology)))
            e.topology = raw.execution.topology;
        const maxAgents = bounded(raw.execution.maxAgents, 1, 8), parallelism = bounded(raw.execution.parallelism, 1, 8);
        if (maxAgents !== undefined)
            e.maxAgents = maxAgents;
        if (parallelism !== undefined)
            e.parallelism = parallelism;
        if (Object.keys(e).length)
            out.execution = e;
    }
    if (raw.models && typeof raw.models === 'object' && !Array.isArray(raw.models)) {
        const m = {};
        if (['adaptive', 'fixed', 'role-mapped'].includes(String(raw.models.mode)))
            m.mode = raw.models.mode;
        if (typeof raw.models.default === 'string' && raw.models.default.trim())
            m.default = raw.models.default.trim();
        if (raw.models.roles && typeof raw.models.roles === 'object' && !Array.isArray(raw.models.roles)) {
            const roles = Object.fromEntries(Object.entries(raw.models.roles).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, String(v).trim()]));
            if (Object.keys(roles).length)
                m.roles = roles;
        }
        if (Object.keys(m).length)
            out.models = m;
    }
    if (raw.parallel && typeof raw.parallel === 'object' && !Array.isArray(raw.parallel)) {
        const x = {};
        if (typeof raw.parallel.enabled === 'boolean')
            x.enabled = raw.parallel.enabled;
        const max = bounded(raw.parallel.max, 1, 8);
        if (max !== undefined)
            x.max = max;
        for (const key of ['providers', 'models'])
            if (raw.parallel[key] && typeof raw.parallel[key] === 'object' && !Array.isArray(raw.parallel[key])) {
                const limits = {};
                for (const [k, v] of Object.entries(raw.parallel[key]))
                    if (typeof v === 'number' && Number.isInteger(v) && v > 0)
                        limits[k] = Math.min(32, v);
                if (Object.keys(limits).length)
                    x[key] = limits;
            }
        if (Object.keys(x).length)
            out.parallel = x;
    }
    if (raw.profile && typeof raw.profile === 'object' && !Array.isArray(raw.profile)) {
        const profiles = {};
        for (const name of ['minimal', 'balanced', 'thorough']) {
            const source = raw.profile[name];
            if (!source || typeof source !== 'object' || Array.isArray(source))
                continue;
            const x = {};
            if (['low', 'medium', 'high'].includes(String(source.specialistThreshold)))
                x.specialistThreshold = source.specialistThreshold;
            if (['low', 'medium', 'high'].includes(String(source.reviewThreshold)))
                x.reviewThreshold = source.reviewThreshold;
            if (Object.keys(x).length)
                profiles[name] = x;
        }
        if (Object.keys(profiles).length)
            out.profile = profiles;
    }
    return out;
}
