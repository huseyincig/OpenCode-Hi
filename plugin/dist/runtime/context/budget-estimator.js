function modelID(model) { return typeof model === 'string' ? model : model?.id; }
function contentChars(input) { const content = typeof input === 'object' && !Array.isArray(input) && 'content' in input ? input.content : input; return (Array.isArray(content) ? content.join('\n') : String(content)).length; }
function observation(input) { return typeof input === 'object' && !Array.isArray(input) && 'content' in input ? input.observed : undefined; }
function validObserved(o) { return Boolean(o) && Number.isFinite(o.value) && o.value >= 0 && ['tokens', 'characters'].includes(o.unit) && ['host-observed', 'provider-usage'].includes(o.source) && o.confidence === 'exact'; }
export class DefaultContextBudgetEstimator {
    estimate(input, model) {
        const observed = observation(input), selected = modelID(model);
        if (validObserved(observed) && (!observed.model_identity || !selected || observed.model_identity === selected))
            return { value: observed.value, unit: observed.unit, source: observed.source, confidence: 'exact' };
        const chars = contentChars(input);
        if (selected)
            return { value: Math.ceil(chars / 4), unit: 'tokens', source: 'estimated', confidence: 'estimated' };
        return { value: chars, unit: 'characters', source: 'fallback', confidence: 'exact' };
    }
}
export const contextBudgetEstimator = new DefaultContextBudgetEstimator();
export function providerUsageObservation(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i], info = message?.info ?? message?.message ?? message;
        if (info?.role !== 'assistant')
            continue;
        const input = info?.tokens?.input;
        if (typeof input !== 'number' || !Number.isFinite(input) || input < 0)
            continue;
        const provider = info?.providerID ?? info?.providerId, model = info?.modelID ?? info?.modelId;
        return { value: input, unit: 'tokens', source: 'provider-usage', confidence: 'exact', ...(provider && model ? { model_identity: `${String(provider)}/${String(model)}` } : {}) };
    }
    return undefined;
}
