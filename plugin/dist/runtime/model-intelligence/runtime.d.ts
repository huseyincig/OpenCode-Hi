import { type ExecutionTokenUsage } from '../../contracts/execution-usage.js';
import type { Category, MissionState } from '../mission/types.js';
import type { AvailableModel, MissionModelFeedback } from '../routing/model-resolver.js';
export interface ModelIntelligenceUsageView {
    model: string;
    observations: number;
    complete_step_observations: number;
    partial_message_observations: number;
    exact_step_tokens: ExecutionTokenUsage;
    opencode_derived_cost_usd: number;
    provider_billed_cost_usd: number;
}
export interface ModelIntelligenceView {
    inventory: {
        source: 'opencode-live';
        models: AvailableModel[];
    };
    feedback: {
        source: 'mission-derived';
        authority: 'advisory-only';
        value: MissionModelFeedback;
    };
    usage: {
        source: 'worker.usage_observations';
        claim_boundary: 'observed-only';
        models: ModelIntelligenceUsageView[];
    };
}
/**
 * Derived Model Intelligence projection.
 *
 * This function does not own live inventory, raw usage history, routing policy,
 * or persisted model preference. Missing observations remain missing; partial
 * message reports are counted but never promoted into exact step totals.
 */
export declare function modelIntelligenceView(mission: MissionState, liveInventory: readonly AvailableModel[], role?: string, category?: Category): ModelIntelligenceView;
