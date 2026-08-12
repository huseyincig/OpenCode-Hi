export type ContextClass = 'PROTECTED' | 'COMPRESSIBLE' | 'PURGEABLE';
export interface ContextEntry {
    id: string;
    kind: string;
    text: string;
    contextClass: ContextClass;
    createdAt: number;
    sourceHash?: string;
}
export interface ContextGovernorResult {
    action: 'NOOP' | 'REDUCED';
    entries: ContextEntry[];
    removedIds: string[];
    compressedIds: string[];
    beforeChars: number;
    afterChars: number;
}
export interface ContextGovernorOptions {
    maxChars: number;
    compressToChars?: number;
}
export declare function governContext(entries: ContextEntry[], options: ContextGovernorOptions): ContextGovernorResult;
