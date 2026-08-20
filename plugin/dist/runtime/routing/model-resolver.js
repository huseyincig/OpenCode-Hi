import { MODEL_ROUTED_CHILD_ROLES } from '../../config/schema.js';
import { providerPolicyView } from '../host/provider-policy.js';
const CATEGORY_TAG = { quick: ['fast', 'cheap'], standard: ['balanced'], deep: ['reasoning', 'coding'], visual: ['vision', 'coding'], critical: ['reasoning', 'high-assurance'] };
const EXPECTED = { quick: { turns: 2, context: .5 }, standard: { turns: 4, context: 1 }, deep: { turns: 7, context: 1.5 }, visual: { turns: 5, context: 1.2 }, critical: { turns: 8, context: 1.7 } };
const VARIANT_PREFERENCE = { quick: ['low', 'minimal', 'none'], standard: ['medium', 'low', 'none'], deep: ['high', 'xhigh', 'medium'], visual: ['high', 'medium', 'xhigh'], critical: ['xhigh', 'max', 'high'] };
const INITIAL_RECOMMENDATION_CATEGORY = { coder: 'standard', architect: 'deep', 'repository-explorer': 'standard', 'qa-reviewer': 'critical', 'security-reviewer': 'critical', 'visual-qa': 'visual' };
function providerOf(m) { return m.provider ?? (m.id.includes('/') ? m.id.slice(0, m.id.indexOf('/')) : undefined); }
function requiredRoleCapability(role) { return role === 'visual-qa' ? 'vision' : undefined; }
function roleCapabilityEligible(model, role) { const required = requiredRoleCapability(role); if (required === 'vision' && model.visionCapable !== true)
    return { ok: false, reason: 'role-capability-missing:vision' }; return { ok: true }; }
function policyFilter(available, config, hostConfig, role) {
    const explicitAllowed = new Set(config.routing.allowedProviders), deniedModels = new Set(config.routing.deniedModels), native = providerPolicyView(hostConfig), rejected = [], allowed = [];
    for (const m of available) {
        const provider = providerOf(m);
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
    return { allowed, rejected, nativePolicySources: native.source };
}
function uniqueRuntime(ids, available) { const live = new Set(available.map(m => m.id)); return [...new Set(ids)].filter(id => live.has(id)); }
export function runtimeModelCandidateStatus(id, availableInput, config, hostConfig, role) {
    if (id === 'host-default') {
        if (requiredRoleCapability(role))
            return { ok: false, reason: `host-default-unverified-role-capability:${requiredRoleCapability(role)}` };
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
function chooseVariant(category, model, config, role) { if (!model?.variants?.length)
    return undefined; const rolePreferred = role && model ? config.routing.roleVariants?.[role]?.[model.id] : undefined; const preferred = [...(rolePreferred ? [rolePreferred] : []), ...(config.routing.categoryVariants?.[category] ?? []), ...VARIANT_PREFERENCE[category]]; for (const v of preferred)
    if (model.variants.includes(v))
        return v; return model.variants[0]; }
function feedbackConfidenceFor(id, feedback) { const samples = Math.max(0, feedback.samples?.[id] ?? 0); return feedback.confidence?.[id] ?? (samples >= 8 ? 'high' : samples >= 4 ? 'medium' : samples >= 2 ? 'low' : 'insufficient'); }
export function resolveModel(category, availableInput, config, explicit, role, hostConfig, feedback = {}) {
    const { allowed: available, rejected, nativePolicySources } = policyFilter(availableInput, config, hostConfig, role), reason = [], preferred = [];
    if (!availableInput.length) {
        const deniedDefault = config.routing.deniedModels.includes('host-default');
        if (!deniedDefault && !config.routing.allowedProviders.length && !requiredRoleCapability(role)) {
            return { primary: 'host-default', fallbacks: [], fallbackVariants: {}, reason: ['runtime inventory unavailable', 'policy permits host-default compatibility delegation'], fallbackReasons: [], rejected };
        }
    }
    if (explicit) {
        if (available.some(m => m.id === explicit)) {
            preferred.push(explicit);
            reason.push('explicit override', 'runtime available', 'policy allowed');
        }
        else if (availableInput.some(m => m.id === explicit))
            reason.push('explicit override rejected by routing/provider policy; fallback constrained to policy');
        else
            reason.push('explicit override unavailable; fallback allowed');
    }
    const projectModel = config.models?.mode === 'fixed' && config.models.default !== 'auto' ? config.models.default : config.models?.mode === 'role-mapped' && role ? config.models.roles[role] : undefined;
    if (!explicit && projectModel) {
        preferred.push(projectModel);
        reason.push(config.models?.mode === 'fixed' ? 'project fixed-model override' : `project role-model override:${role}`);
    }
    const roleConfigured = role ? config.routing.roleModels[role] ?? [] : [];
    if (roleConfigured.length) {
        preferred.push(...roleConfigured);
        reason.push(`role override:${role}`);
    }
    const categoryConfigured = config.routing.categoryModels[category] ?? [];
    if (categoryConfigured.length) {
        preferred.push(...categoryConfigured);
        reason.push(`category override:${category}`);
    }
    const preferredLive = uniqueRuntime(preferred, available), configuredLive = uniqueRuntime([...roleConfigured, ...categoryConfigured], available), wanted = CATEGORY_TAG[category], expected = EXPECTED[category], configuredFeedbackAdmitted = explicit === undefined && projectModel === undefined && configuredLive.some(id => feedbackConfidenceFor(id, feedback) !== 'insufficient');
    if (roleConfigured.length && roleConfigured[0] && !available.some(m => m.id === roleConfigured[0]))
        reason.push(`role-primary-unavailable-or-policy-rejected:${roleConfigured[0]}`);
    const preferredAllAvailable = roleConfigured.length > 0 && roleConfigured.every(id => available.some(m => m.id === id));
    if (preferredAllAvailable && roleConfigured.length > 0 && explicit === undefined && projectModel === undefined && categoryConfigured.length === 0 && !configuredFeedbackAdmitted) {
        const primary = preferredLive[0];
        const fallbacks = preferredLive.slice(1, 1 + config.routing.maxFallbacks);
        const byId = new Map(available.map(m => [m.id, m]));
        const primaryVariant = chooseVariant(category, byId.get(primary), config, role);
        const fallbackVariants = {};
        for (const id of fallbacks)
            fallbackVariants[id] = chooseVariant(category, byId.get(id), config, role);
        if (!reason.length)
            reason.push(`${category} category`);
        reason.push('configured-role-prior-fast-path:role-override-available,skip-scoring', 'write-capable', 'runtime available', 'routing policy allowed', primaryVariant ? `variant:${primaryVariant}` : 'variant:host/default', `fallbacks=${fallbacks.length}`);
        if (nativePolicySources.length)
            reason.push(`host-provider-policy:${nativePolicySources.join('+')}`);
        const fallbackReasons = fallbacks.map((model, i) => ({ model, variant: fallbackVariants[model], reason: `fallback-${i + 1}: role-configured alternative${fallbackVariants[model] ? `; variant=${fallbackVariants[model]}` : ''}` }));
        return { primary, primaryVariant, fallbacks, fallbackVariants, reason, fallbackReasons, rejected };
    }
    const scored = available.map(m => { const tags = [...(m.tags ?? []), ...(m.visionCapable === true ? ['vision'] : [])], tagScore = wanted.filter(t => tags.includes(t)).length * 4, quality = m.quality ?? 0, cost = Math.max(0, m.cost ?? 0), turns = Math.max(1, m.expectedTurns ?? expected.turns), context = Math.max(0, m.contextOverhead ?? expected.context), rawFailures = Math.max(0, feedback.failures?.[m.id] ?? 0), rawRetries = Math.max(0, feedback.retries?.[m.id] ?? 0), rawSuccesses = Math.max(0, feedback.successes?.[m.id] ?? 0), signalCount = feedback.samples?.[m.id] !== undefined ? Math.max(0, feedback.samples[m.id] ?? 0) : rawFailures + rawSuccesses, feedbackConfidence = feedback.confidence?.[m.id] ?? (signalCount >= 8 ? 'high' : signalCount >= 4 ? 'medium' : signalCount >= 2 ? 'low' : 'insufficient'), admitted = feedbackConfidence !== 'insufficient', failures = admitted ? rawFailures : 0, retries = admitted ? rawRetries : 0, successes = admitted ? rawSuccesses : 0, verificationPasses = admitted ? Math.max(0, feedback.verification_passes?.[m.id] ?? 0) : 0, verificationFailures = admitted ? Math.max(0, feedback.verification_failures?.[m.id] ?? 0) : 0, failurePenalty = (failures * 1.75) + (retries * .85), successCredit = Math.min(2, successes * .35), verificationAdjustment = Math.max(-1, Math.min(1, (verificationPasses - verificationFailures) * .25)), retryMultiplier = 1 + (failures * .6) + (retries * .35), expectedCompletionCost = (cost + .08 * turns + .2 * context) * retryMultiplier, strategy = config.routing.strategy === 'quality' ? quality * 2 : config.routing.strategy === 'cost' ? -expectedCompletionCost * 2 : quality - expectedCompletionCost; return { model: m, score: tagScore + strategy - failurePenalty + successCredit + verificationAdjustment, turns, context, expectedCompletionCost, failurePenalty, successCredit, verificationAdjustment, feedbackConfidence, observedLatencyMs: feedback.average_latency_ms?.[m.id] }; }).sort((a, b) => b.score - a.score);
    const scoreByModel = new Map(scored.map(x => [x.model.id, x.score])), evidenceOrderedConfigured = configuredFeedbackAdmitted ? [...configuredLive].sort((a, b) => (scoreByModel.get(b) ?? -Infinity) - (scoreByModel.get(a) ?? -Infinity)) : configuredLive, preferredOrder = configuredFeedbackAdmitted ? evidenceOrderedConfigured : preferredLive, ordered = [...new Set([...preferredOrder, ...scored.map(x => x.model.id)])], primary = ordered[0], fallbacks = ordered.slice(1, 1 + config.routing.maxFallbacks), byId = new Map(available.map(m => [m.id, m])), primaryVariant = chooseVariant(category, byId.get(primary), config, role), fallbackVariants = {};
    for (const id of fallbacks)
        fallbackVariants[id] = chooseVariant(category, byId.get(id), config, role);
    if (!reason.length)
        reason.push(`${category} category`);
    if (configuredFeedbackAdmitted)
        reason.push('empirical-feedback-reranked-configured-priors');
    reason.push('write-capable', 'runtime available', 'routing policy allowed', `${config.routing.strategy} scoring`, `expected-completion-cost-aware`, `expected-completion-cost-basis:heuristic`, `bounded-window-model-feedback-aware`, primaryVariant ? `variant:${primaryVariant}` : 'variant:host/default', `fallbacks=${fallbacks.length}`);
    if (nativePolicySources.length)
        reason.push(`host-provider-policy:${nativePolicySources.join('+')}`);
    const fallbackReasons = fallbacks.map((model, i) => ({ model, variant: fallbackVariants[model], reason: `fallback-${i + 1}: policy-allowed alternate preserving ${category} capability after higher-ranked model${fallbackVariants[model] ? `; variant=${fallbackVariants[model]}` : ''}` }));
    return { primary, primaryVariant, fallbacks, fallbackVariants, reason, fallbackReasons, rejected, scores: scored.slice(0, 12).map(x => ({ model: x.model.id, score: Number(x.score.toFixed(4)), expected_completion_cost: Number(x.expectedCompletionCost.toFixed(4)), expected_completion_cost_basis: 'heuristic', failure_penalty: Number(x.failurePenalty.toFixed(4)), success_credit: Number(x.successCredit.toFixed(4)), verification_adjustment: Number(x.verificationAdjustment.toFixed(4)), feedback_confidence: x.feedbackConfidence, ...(x.observedLatencyMs !== undefined ? { observed_latency_ms: x.observedLatencyMs } : {}) })) };
}
export function recommendInitialRoleModels(available, config, hostConfig) {
    const out = {};
    for (const role of MODEL_ROUTED_CHILD_ROLES) {
        const selected = resolveModel(INITIAL_RECOMMENDATION_CATEGORY[role], available, config, undefined, role, hostConfig);
        if (selected.primary && selected.primary !== 'host-default')
            out[role] = [selected.primary];
    }
    return out;
}
