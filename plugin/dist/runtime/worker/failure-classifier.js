function structured(error) {
    const value = error && typeof error === 'object' ? error : undefined, name = String(value?.name ?? '').trim(), message = String(value?.message ?? error ?? '').trim(), isRetryable = typeof value?.isRetryable === 'boolean' ? value.isRetryable : undefined, statusCode = Number.isInteger(value?.statusCode) && value.statusCode >= 0 ? value.statusCode : undefined;
    return { name, text: message.toLowerCase(), ...(isRetryable !== undefined ? { isRetryable } : {}), ...(statusCode !== undefined ? { statusCode } : {}) };
}
export function classifyWorkerFailure(error) {
    const observed = structured(error), name = observed.name, text = observed.text;
    if (name === 'ProviderAuthError' || /permission|denied|forbidden|unauthori[sz]ed|approval|oauth|mfa/.test(text))
        return { kind: 'permission', stagnation: false, retryable: false, reason: name === 'ProviderAuthError' ? 'opencode-provider-auth-error' : 'permission-or-authority-boundary' };
    if (name === 'ContextOverflowError' || /context.*(limit|overflow|length)|too many tokens|maximum context/.test(text))
        return { kind: 'context-overflow', stagnation: false, retryable: true, reason: name === 'ContextOverflowError' ? 'opencode-terminal-context-overflow' : 'context-capacity-failure' };
    if (name === 'MessageAbortedError')
        return { kind: 'unknown', stagnation: false, retryable: false, reason: 'opencode-message-aborted' };
    if (name === 'APIError') {
        // OpenCode's native json_schema WorkerResult transport requires tool_choice=required.
        // Provider inventory exposes generic tool-call capability but not supported tool-choice
        // modes, so an auto-only provider can be discovered only from this terminal wire error.
        // Keep ordinary 4xx failures nonretryable; only this exact protocol incompatibility may
        // consume an already-authorized alternate-model recovery candidate.
        const autoOnlyRequiredToolChoice = /tool[_\s-]?choice/.test(text) && /only\s+[`"'\\]*auto[`"'\\]*\s+is\s+supported/.test(text) && /(?:required|named\s+function)/.test(text) && /(?:not\s+(?:currently\s+)?supported|unsupported)/.test(text);
        const thinkingModeRequiredToolChoice = /thinking\s+mode\s+does\s+not\s+support\s+(?:this\s+)?tool[_\s-]?choice/.test(text);
        if (autoOnlyRequiredToolChoice || thinkingModeRequiredToolChoice)
            return { kind: 'provider-transport', stagnation: false, retryable: true, reason: 'opencode-required-tool-choice-compatibility-fallback-eligible' };
        // A provider-policy 404 can be terminal for this exact model while another already-authorized
        // model remains viable. Treat only the explicit model/provider-availability wire error as
        // cross-model fallback eligible; ordinary 4xx request/auth failures remain fail-closed.
        if (/no allowed providers? (?:are )?available for the selected model/.test(text))
            return { kind: 'provider-transport', stagnation: false, retryable: true, reason: 'opencode-selected-model-provider-unavailable-fallback-eligible' };
        const fallbackEligible = observed.isRetryable === true || observed.statusCode === 429 || (observed.statusCode !== undefined && observed.statusCode >= 500);
        return { kind: 'provider-transport', stagnation: false, retryable: fallbackEligible, reason: fallbackEligible ? 'opencode-terminal-api-error-fallback-eligible' : 'opencode-terminal-api-error-nonretryable' };
    }
    if (/command not found|missing dependency|cannot find module|no module named|enoent|environment/.test(text))
        return { kind: 'environment', stagnation: false, retryable: false, reason: 'environment-failure' };
    if (/tool.*(unsupported|unavailable|invalid)|model.*tool|function calling/.test(text))
        return { kind: 'tool-incompatibility', stagnation: false, retryable: true, reason: 'model-tool-compatibility-failure' };
    if (/rate.?limit|429|quota|provider|upstream|gateway|503|502|network[-_\s]?error|connection|timeout|timed out|transport|socket|econn|temporar/.test(text))
        return { kind: 'provider-transport', stagnation: false, retryable: true, reason: 'legacy-provider-or-transport-failure' };
    if (/test|assert|logic|incorrect|failed expectation|compile/.test(text))
        return { kind: 'reasoning-task', stagnation: true, retryable: true, reason: 'task-or-reasoning-failure' };
    return { kind: 'unknown', stagnation: true, retryable: false, reason: 'unclassified-worker-failure' };
}
