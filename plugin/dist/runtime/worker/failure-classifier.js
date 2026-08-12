export function classifyWorkerFailure(error) {
    const text = String(error?.message ?? error ?? '').toLowerCase();
    if (/rate.?limit|429|quota|provider|upstream|gateway|503|502|network|connection|timeout|timed out|transport|socket|econn|temporar/.test(text))
        return { kind: 'provider-transport', stagnation: false, retryable: true, reason: 'provider-or-transport-failure' };
    if (/permission|denied|forbidden|unauthori[sz]ed|approval|oauth|mfa/.test(text))
        return { kind: 'permission', stagnation: false, retryable: false, reason: 'permission-or-authority-boundary' };
    if (/context.*(limit|overflow|length)|too many tokens|maximum context/.test(text))
        return { kind: 'context-overflow', stagnation: false, retryable: true, reason: 'context-capacity-failure' };
    if (/command not found|missing dependency|cannot find module|no module named|enoent|environment/.test(text))
        return { kind: 'environment', stagnation: false, retryable: false, reason: 'environment-failure' };
    if (/tool.*(unsupported|unavailable|invalid)|model.*tool|function calling/.test(text))
        return { kind: 'tool-incompatibility', stagnation: false, retryable: true, reason: 'model-tool-compatibility-failure' };
    if (/test|assert|logic|incorrect|failed expectation|compile/.test(text))
        return { kind: 'reasoning-task', stagnation: true, retryable: true, reason: 'task-or-reasoning-failure' };
    return { kind: 'unknown', stagnation: true, retryable: true, reason: 'unclassified-worker-failure' };
}
