import { MODEL_ROUTED_CHILD_ROLES } from '../../config/schema.js';
import { providerPolicyView } from '../host/provider-policy.js';
const AUTOMATIC_CAPABILITY_PREFERENCE = { quick: ['fast', 'coding'], standard: ['coding', 'balanced'], deep: ['reasoning', 'coding'], visual: ['coding', 'reasoning'], critical: ['high-assurance', 'reasoning', 'coding'] };
const VARIANT_PREFERENCE = { quick: ['low', 'minimal', 'none'], standard: ['medium', 'low', 'none'], deep: ['high', 'xhigh', 'medium'], visual: ['high', 'medium', 'xhigh'], critical: ['xhigh', 'max', 'high'] };
const INITIAL_RECOMMENDATION_CATEGORY = { coder: 'standard', architect: 'deep', 'repository-explorer': 'standard', 'qa-reviewer': 'critical', 'security-reviewer': 'critical', 'visual-qa': 'visual' };
function record(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined; }
function providerOf(m) { return m.provider ?? (m.id.includes('/') ? m.id.slice(0, m.id.indexOf('/')) : undefined); }
function requiredRoleCapability(role) { return role === 'visual-qa' ? 'vision' : undefined; }
function roleCapabilityEligible(model, role) { const required = requiredRoleCapability(role); if (required === 'vision' && model.visionCapable !== true)
    return { ok: false, reason: 'role-capability-missing:vision' }; return { ok: true }; }
function policyFilter(available, config, hostConfig, role) {
    const allowedModelOrder = config.routing.allowedModels ?? [], explicitAllowedModels = new Set(allowedModelOrder), explicitAllowed = new Set(config.routing.allowedProviders), deniedModels = new Set(config.routing.deniedModels), native = providerPolicyView(hostConfig), rejected = [], allowed = [];
    for (const m of available) {
        const provider = providerOf(m);
        if (explicitAllowedModels.size && !explicitAllowedModels.has(m.id)) {
            rejected.push({ id: m.id, reason: 'hi-model-not-allowed' });
            continue;
        }
        if (deniedModels.has(m.id)) {
            rejected.push({ id: m.id, reason: 'hi-denied-model' });
            continue;
        }
        if (explicitAllowed.size && (!provider || !explicitAllowed.has(provider))) {
            rejected.push({ id: m.id, reason: `hi-provider-not-allowed:${provider ?? 'unknown'}` });
            continue;
        }
        if (provider && native.denied.has(provider)) {
            rejected.push({ id: m.id, reason: `host-provider-policy-deny:${provider}` });
            continue;
        }
        if (native.allowed.size && provider && !native.allowed.has(provider)) {
            rejected.push({ id: m.id, reason: `host-provider-not-enabled:${provider}` });
            continue;
        }
        if (m.writeCapable === false) {
            rejected.push({ id: m.id, reason: 'not-write-capable' });
            continue;
        }
        const roleCapability = roleCapabilityEligible(m, role);
        if (!roleCapability.ok) {
            rejected.push({ id: m.id, reason: roleCapability.reason ?? 'role-capability-missing' });
            continue;
        }
        allowed.push(m);
    }
    if (allowedModelOrder.length)
        allowed.sort((a, b) => allowedModelOrder.indexOf(a.id) - allowedModelOrder.indexOf(b.id));
    return { allowed, rejected, nativePolicySources: native.source };
}
export function runtimeModelCandidateStatus(id, availableInput, config, hostConfig, role) {
    if (id === 'host-default') {
        if (requiredRoleCapability(role))
            return { ok: false, reason: `host-default-unverified-role-capability:${requiredRoleCapability(role)}` };
        if ((config.routing.allowedModels ?? []).length)
            return { ok: false, reason: 'host-default-disallowed-by-explicit-model-allowlist' };
        if (config.routing.deniedModels.includes('host-default'))
            return { ok: false, reason: 'hi-denied-model:host-default' };
        if (config.routing.allowedProviders.length)
            return { ok: false, reason: 'host-default-disallowed-by-explicit-provider-allowlist' };
        const native = providerPolicyView(hostConfig);
        if (native.allowed.size)
            return { ok: false, reason: 'host-default-disallowed-by-host-provider-allowlist' };
        return { ok: true };
    }
    const found = availableInput.find(m => m.id === id);
    if (!found && availableInput.length)
        return { ok: false, reason: 'runtime-model-unavailable' };
    const candidate = found ?? { id, provider: providerOf({ id }), writeCapable: true };
    const checked = policyFilter([candidate], config, hostConfig, role);
    if (checked.allowed.length)
        return { ok: true, reason: found ? 'runtime-model-available' : 'runtime-inventory-unavailable-pre-resolved-candidate' };
    return { ok: false, reason: checked.rejected[0]?.reason ?? 'routing-policy-rejected' };
}
function chooseVariant(category, model, config, role, hostVariant) {
    if (!model?.variants?.length)
        return hostVariant;
    if (hostVariant)
        return model.variants.includes(hostVariant) ? hostVariant : undefined;
    const rolePreferred = role ? config.routing.roleVariants?.[role]?.[model.id] : undefined, preferred = [...(rolePreferred ? [rolePreferred] : []), ...(config.routing.categoryVariants?.[category] ?? []), ...VARIANT_PREFERENCE[category]];
    for (const v of preferred)
        if (model.variants.includes(v))
            return v;
    return model.variants[0];
}
function hostAgentModel(hostConfig, role) {
    if (!role)
        return undefined;
    const agents = record(hostConfig?.agent), agent = agents ? record(agents[role]) : undefined;
    if (!agent)
        return undefined;
    const raw = agent.model;
    let model;
    if (typeof raw === 'string' && raw.trim())
        model = raw.trim();
    else {
        const value = record(raw), provider = typeof value?.providerID === 'string' ? value.providerID : typeof value?.providerId === 'string' ? value.providerId : undefined, id = typeof value?.modelID === 'string' ? value.modelID : typeof value?.modelId === 'string' ? value.modelId : typeof value?.id === 'string' ? value.id : undefined;
        if (provider && id)
            model = `${provider}/${id}`;
    }
    const variant = typeof agent.variant === 'string' && agent.variant.trim() ? agent.variant.trim() : undefined;
    return model || variant ? { model, variant } : undefined;
}
function automaticCandidateRank(category, model, index) {
    const wanted = AUTOMATIC_CAPABILITY_PREFERENCE[category], tags = new Set([...(model.tags ?? []), ...(model.visionCapable === true ? ['vision'] : [])]), capabilities = wanted.map(tag => tags.has(tag) ? 1 : 0), variants = new Set(model.variants ?? []), variantPreferences = VARIANT_PREFERENCE[category];
    let variantRank = variantPreferences.length + 1, variantFit;
    for (let i = 0; i < variantPreferences.length; i++)
        if (variants.has(variantPreferences[i])) {
            variantRank = i;
            variantFit = variantPreferences[i];
            break;
        }
    return { model, index, capabilities, variantRank, matched: wanted.filter(tag => tags.has(tag)), variantFit };
}
function compareAutomaticCandidate(a, b) {
    for (let i = 0; i < Math.max(a.capabilities.length, b.capabilities.length); i++) {
        const av = a.capabilities[i] ?? 0, bv = b.capabilities[i] ?? 0;
        if (av !== bv)
            return bv - av;
    }
    if (a.variantRank !== b.variantRank)
        return a.variantRank - b.variantRank;
    return a.index - b.index;
}
function automaticRecommendation(category, available) {
    const ranked = available.map((model, index) => automaticCandidateRank(category, model, index)).sort(compareAutomaticCandidate), top = ranked[0];
    const explanation = top?.matched.length ? `capability-priority:${top.matched.join('>')}` : 'capability-priority:inventory-order';
    return { ordered: ranked.map(x => x.model), reason: [`${category} capability recommendation`, 'ephemeral automatic selection', explanation, ...(top?.variantFit ? [`variant-fit:${top.variantFit}`] : []), 'cost/quality/feedback are not routing authority', 'not persisted as user preference'] };
}
function resolution(primary, category, available, config, role, reason, rejected, fallbacks = [], hostVariant, nativePolicySources = []) {
    const byId = new Map(available.map(m => [m.id, m])), primaryModel = primary ? byId.get(primary) : undefined, primaryVariant = primary ? chooseVariant(category, primaryModel, config, role, hostVariant) : undefined, fallbackVariants = {};
    for (const id of fallbacks)
        fallbackVariants[id] = chooseVariant(category, byId.get(id), config, role);
    if (nativePolicySources.length)
        reason.push(`host-provider-policy:${nativePolicySources.join('+')}`);
    const fallbackReasons = fallbacks.map((model, i) => ({ model, variant: fallbackVariants[model], reason: `fallback-${i + 1}: explicit role-mapping order${fallbackVariants[model] ? `; variant=${fallbackVariants[model]}` : ''}` }));
    return { primary, primaryVariant, fallbacks, fallbackVariants, reason, fallbackReasons, rejected };
}
export function resolveModel(category, availableInput, config, explicit, role, hostConfig, _feedback) {
    const { allowed: available, rejected, nativePolicySources } = policyFilter(availableInput, config, hostConfig, role), reason = [];
    if (!availableInput.length) {
        const deniedDefault = config.routing.deniedModels.includes('host-default');
        if (!explicit && !config.routing.roleModels[role ?? '']?.length && !deniedDefault && !(config.routing.allowedModels ?? []).length && !config.routing.allowedProviders.length && !requiredRoleCapability(role))
            return resolution('host-default', category, available, config, role, ['runtime inventory unavailable', 'policy permits host-default compatibility delegation'], rejected, [], undefined, nativePolicySources);
    }
    const roleConfigured = role ? config.routing.roleModels[role] ?? [] : [];
    if (roleConfigured.length) {
        if (explicit && explicit !== roleConfigured[0])
            reason.push(`task model override ignored because explicit role mapping is authoritative:${explicit}`);
        const eligible = roleConfigured.filter(id => available.some(m => m.id === id));
        for (const id of roleConfigured)
            if (!eligible.includes(id))
                reason.push(`role-mapped-model-unavailable-or-policy-rejected:${id}`);
        if (!eligible.length) {
            reason.push(`explicit role mapping has no eligible model:${role}`);
            return resolution(undefined, category, available, config, role, reason, rejected, [], undefined, nativePolicySources);
        }
        const primary = eligible[0], fallbacks = eligible.slice(1, 1 + config.routing.maxFallbacks);
        reason.push(`explicit ordered role mapping:${role}`, 'runtime available', 'policy allowed');
        return resolution(primary, category, available, config, role, reason, rejected, fallbacks, undefined, nativePolicySources);
    }
    if (explicit) {
        if (explicit === 'host-default') {
            const status = runtimeModelCandidateStatus(explicit, availableInput, config, hostConfig, role);
            if (status.ok)
                return resolution(explicit, category, available, config, role, ['existing host-default child binding', 'policy allowed'], rejected, [], undefined, nativePolicySources);
            return resolution(undefined, category, available, config, role, [`existing host-default child binding rejected:${status.reason ?? 'routing-policy-rejected'}`], rejected, [], undefined, nativePolicySources);
        }
        if (available.some(m => m.id === explicit))
            return resolution(explicit, category, available, config, role, ['explicit task model', 'runtime available', 'policy allowed'], rejected, [], undefined, nativePolicySources);
        reason.push(availableInput.some(m => m.id === explicit) ? 'explicit task model rejected by routing/provider policy' : 'explicit task model unavailable');
        return resolution(undefined, category, available, config, role, reason, rejected, [], undefined, nativePolicySources);
    }
    if ((config.routing.allowedModels ?? []).length) {
        const primary = available[0]?.id, fallbacks = available.slice(1, 1 + config.routing.maxFallbacks).map(m => m.id);
        reason.push('explicit ordered global model pool', 'runtime available', 'policy allowed');
        return resolution(primary, category, available, config, role, reason, rejected, fallbacks, undefined, nativePolicySources);
    }
    const host = hostAgentModel(hostConfig, role);
    if (host?.model) {
        if (available.some(m => m.id === host.model)) {
            const selected = resolution(host.model, category, available, config, role, ['OpenCode agent explicit model', 'runtime available', 'policy allowed'], rejected, [], host.variant, nativePolicySources);
            if (host.variant && available.find(m => m.id === host.model)?.variants?.length && !selected.primaryVariant) {
                selected.primary = undefined;
                selected.reason.push(`OpenCode agent explicit variant unavailable:${host.variant}`);
            }
            return selected;
        }
        reason.push(`OpenCode agent explicit model unavailable-or-policy-rejected:${host.model}`);
        return resolution(undefined, category, available, config, role, reason, rejected, [], host.variant, nativePolicySources);
    }
    const automatic = automaticRecommendation(category, available), primary = automatic.ordered[0]?.id;
    reason.push(...automatic.reason);
    return resolution(primary, category, available, config, role, reason, rejected, [], undefined, nativePolicySources);
}
/** Pure preview only. Runtime inventory refresh must never persist these inferred choices. */
export function recommendInitialRoleModels(available, config, hostConfig) {
    const out = {};
    for (const role of MODEL_ROUTED_CHILD_ROLES) {
        const selected = resolveModel(INITIAL_RECOMMENDATION_CATEGORY[role], available, config, undefined, role, hostConfig);
        if (selected.primary && selected.primary !== 'host-default')
            out[role] = [selected.primary];
    }
    return out;
}
