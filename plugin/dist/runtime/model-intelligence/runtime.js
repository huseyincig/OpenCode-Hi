import { EMPTY_TOKEN_USAGE, addTokenUsage } from '../../contracts/execution-usage.js';
import { deriveMissionModelFeedback } from '../routing/model-feedback.js';
/**
 * Derived Model Intelligence projection.
 *
 * This function does not own live inventory, raw usage history, routing policy,
 * or persisted model preference. Missing observations remain missing; partial
 * message reports are counted but never promoted into exact step totals.
 */
export function modelIntelligenceView(mission, liveInventory, role, category) {
    const byModel = new Map();
    for (const worker of mission.execution.workers)
        for (const observation of worker.usage_observations ?? []) {
            const model = observation.model_identity ?? worker.effective_model ?? worker.model;
            if (!model)
                continue;
            const current = byModel.get(model) ?? { model, observations: 0, complete_step_observations: 0, partial_message_observations: 0, exact_step_tokens: { ...EMPTY_TOKEN_USAGE }, opencode_derived_cost_usd: 0, provider_billed_cost_usd: 0 };
            current.observations++;
            if (observation.coverage === 'assistant-step-total') {
                current.complete_step_observations++;
                current.exact_step_tokens = addTokenUsage(current.exact_step_tokens, observation.tokens);
            }
            else
                current.partial_message_observations++;
            if (observation.monetary?.source === 'opencode-calculated')
                current.opencode_derived_cost_usd += observation.monetary.usd;
            if (observation.monetary?.source === 'provider-billed')
                current.provider_billed_cost_usd += observation.monetary.usd;
            byModel.set(model, current);
        }
    return {
        inventory: { source: 'opencode-live', models: liveInventory.map(model => ({ ...model })) },
        feedback: { source: 'mission-derived', authority: 'advisory-only', value: deriveMissionModelFeedback(mission, role, category) },
        usage: { source: 'worker.usage_observations', claim_boundary: 'observed-only', models: [...byModel.values()].sort((a, b) => a.model.localeCompare(b.model)) },
    };
}
