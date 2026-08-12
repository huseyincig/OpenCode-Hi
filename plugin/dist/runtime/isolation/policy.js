export function decideIsolation(intent, untrusted = false) { if (untrusted)
    return { level: 'UNTRUSTED', mechanism: 'restricted-sandbox', reason: 'untrusted execution requires restricted capabilities' }; if (intent.risk === 'high')
    return { level: 'MEDIUM', mechanism: 'git-worktree', reason: 'high-risk change benefits from workspace separation' }; if (intent.risk === 'authority-boundary')
    return { level: 'HIGH', mechanism: 'isolated-environment', reason: 'external side-effect boundary requires stronger isolation when available' }; return { level: 'LOW', mechanism: 'current-workspace', reason: 'low-risk task does not justify isolation overhead' }; }
