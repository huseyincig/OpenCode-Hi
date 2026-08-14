export declare const SEMANTIC_CONTEXT_SYMBOL_KINDS: readonly ["interface", "type", "class", "function", "enum"];
export type SemanticContextSymbolKind = typeof SEMANTIC_CONTEXT_SYMBOL_KINDS[number];
export interface SemanticContextSymbol {
    kind: SemanticContextSymbolKind;
    name: string;
    signature: string;
    start: number;
    end: number;
}
export interface SemanticContextRelationship {
    kind: string;
    source_symbol: string;
    target_symbol: string;
}
export interface SemanticContextRange {
    start: number;
    end: number;
}
export interface SemanticContextBudget {
    max_chars: number;
    used_chars: number;
}
export interface SemanticContextContract {
    id: string;
    source_ref: string;
    source_hash: string;
    language_adapter: 'typescript';
    symbols: SemanticContextSymbol[];
    relationships: SemanticContextRelationship[];
    selected_ranges: SemanticContextRange[];
    consumer_task_ref: string;
    budget: SemanticContextBudget;
    created_at: number;
    text: string;
}
export declare function semanticContextId(input: {
    consumer_task_ref: string;
    source_ref: string;
    source_hash: string;
    selected_ranges: SemanticContextRange[];
}): string;
export declare function isSemanticContextContract(v: unknown): v is SemanticContextContract;
