export function executionProfileFor(mode, intent) {
    if (mode === 'minimal' || mode === 'balanced' || mode === 'thorough')
        return mode;
    if (mode === 'manual')
        return 'balanced';
    if (intent.risk === 'high' || intent.risk === 'authority-boundary')
        return 'thorough';
    if (intent.risk === 'low' && intent.scope === 'local' && intent.ambiguity === 'none')
        return 'minimal';
    return 'balanced';
}
export function automaticContinuationEnabled(mode) { return mode !== 'manual'; }
export function adaptiveIdleEvaluatorEnabled(mode) { return mode === 'adaptive'; }
