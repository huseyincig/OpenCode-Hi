import { type SemanticContextContract, type SemanticContextSymbol } from '../../contracts/semantic-context.js';
export interface SemanticContextResult {
    symbols: SemanticContextSymbol[];
    text: string;
    sourceChars: number;
    contextChars: number;
}
export declare function extractTypeScriptSemanticContext(source: string, names?: string[], maxChars?: number): SemanticContextResult;
export declare function typescriptSemanticContextsForTargets(projectRoot: string, targets: string[], consumerTaskRef: string, maxChars?: number): SemanticContextContract[];
export declare function renderSemanticContext(contract: SemanticContextContract): string;
