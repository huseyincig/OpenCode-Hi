export function resolveExecutionMode(intent, m) { if (m?.execution_mode === 'team')
    return { mode: 'team', reason: ['existing bounded team remains authoritative'] }; if (intent.risk === 'authority-boundary')
    return { mode: 'single', reason: ['authority boundary forbids speculative parallel work'] }; if (intent.scope === 'multi-stream')
    return { mode: 'parallel', reason: ['multiple independent workstreams detected in objective'] }; if (intent.scope === 'local' || intent.requiredCapabilities.length <= 1)
    return { mode: 'single', reason: ['minimum sufficient execution'] }; const independentReview = intent.taskKind === 'review' && ['security-review', 'visual-qa', 'review'].filter(x => intent.requiredCapabilities.includes(x)).length >= 2; if (independentReview)
    return { mode: 'parallel', reason: ['multiple independent read-only review domains are proven'] }; return { mode: 'single', reason: ['no proven independent parallel branches'] }; }
