import type { ContextFreshness, ContextPriority, ContextProtection } from '../../contracts/context-reference.js';
export interface ContextProjectionGroup {
    id: string;
    items: string[];
    priority: ContextPriority;
    protection: ContextProtection;
    freshness: ContextFreshness;
    required?: boolean;
    content_hash?: string;
    source_ref?: string;
}
export interface ContextProjectionDecision {
    selected: ContextProjectionGroup[];
    omitted: string[];
    used_chars: number;
    budget_chars: number;
    complete: boolean;
    missing_required: string[];
    duplicate_groups: string[];
}
export declare function projectContextGroups(groups: readonly ContextProjectionGroup[], budgetChars: number): ContextProjectionDecision;
export declare function renderProjectedContext(decision: ContextProjectionDecision): string[];
