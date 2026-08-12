export declare const DEFAULT_CONTEXT_BUDGET: {
    readonly max_context_chars: 12000;
    readonly max_handoff_chars: 18000;
    readonly max_result_chars: 16000;
    readonly max_artifacts: 8;
};
export declare function clipText(value: string | undefined, max: number): string;
export declare function clipList(values: string[] | undefined, maxChars: number, maxItems?: number): string[];
