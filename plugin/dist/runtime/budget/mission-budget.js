export const DEFAULT_MISSION_BUDGET = { maxTurns: 20, maxModelCalls: 12, maxToolCalls: 80, maxDelegations: 4, maxParallelism: 2, maxSameFailureRetries: 2, maxContextChars: 120000, planningBudget: 1, verificationBudget: 4, reviewBudget: 1 };
export function budgetExceeded(b, u) { const out = []; if (u.turns >= b.maxTurns)
    out.push('turns'); if (u.modelCalls >= b.maxModelCalls)
    out.push('modelCalls'); if (u.toolCalls >= b.maxToolCalls)
    out.push('toolCalls'); if (u.delegations >= b.maxDelegations)
    out.push('delegations'); if (u.contextChars >= b.maxContextChars)
    out.push('contextChars'); if (u.planning > b.planningBudget)
    out.push('planning'); if (u.verification > b.verificationBudget)
    out.push('verification'); if (u.review > b.reviewBudget)
    out.push('review'); return out; }
export function materiallyDifferentRetry(previous, next) { return previous.failure !== next.failure || previous.strategy !== next.strategy || previous.evidence !== next.evidence || previous.tool !== next.tool || previous.model !== next.model; }
