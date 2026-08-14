import { type SemanticContextContract } from '../../contracts/semantic-context.js';
import type { SemanticContextAdapter, SemanticContextAdapterInput, SemanticContextResult } from './adapter.js';
export declare class TypeScriptSemanticContextAdapter implements SemanticContextAdapter {
    languageIds(): string[];
    supports(file: string): boolean;
    extract(input: SemanticContextAdapterInput): SemanticContextResult;
}
export declare const TYPE_SCRIPT_SEMANTIC_CONTEXT_ADAPTER: TypeScriptSemanticContextAdapter;
export declare const SEMANTIC_CONTEXT_ADAPTERS: readonly SemanticContextAdapter[];
export declare function extractTypeScriptSemanticContext(source: string, names?: string[], maxChars?: number): SemanticContextResult;
export declare function semanticContextsForTargets(projectRoot: string, targets: string[], consumerTaskRef: string, maxChars?: number, adapters?: readonly SemanticContextAdapter[]): SemanticContextContract[];
export declare function typescriptSemanticContextsForTargets(projectRoot: string, targets: string[], consumerTaskRef: string, maxChars?: number): SemanticContextContract[];
export declare function renderSemanticContext(contract: SemanticContextContract): string;
