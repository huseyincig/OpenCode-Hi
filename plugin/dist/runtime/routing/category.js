export function resolveCategory(intent) {
    if (intent.risk === 'high' || intent.risk === 'authority-boundary')
        return 'critical';
    if (intent.requiredCapabilities.includes('visual-qa'))
        return 'visual';
    if (intent.scope === 'repo-wide' || intent.taskKind === 'performance')
        return 'deep';
    if (intent.scope === 'local' && intent.taskKind !== 'bug-fix')
        return 'quick';
    return 'standard';
}
export function continuationBudget(category) {
    return category === 'quick' ? 2 : category === 'standard' || category === 'visual' ? 4 : category === 'deep' ? 6 : 5;
}
