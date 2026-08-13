export interface SemanticSymbol {
    kind: 'interface' | 'type' | 'class' | 'function' | 'enum';
    name: string;
    signature: string;
    start: number;
}
export interface SemanticContextResult {
    symbols: SemanticSymbol[];
    text: string;
    sourceChars: number;
    contextChars: number;
}
export declare function extractTypeScriptSemanticContext(source: string, names?: string[], maxChars?: number): SemanticContextResult;
export declare function typescriptSemanticContextForTargets(projectRoot: string, targets: string[], maxChars?: number): string[];
