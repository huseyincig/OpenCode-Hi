export interface DurableContextArtifact {
    id: string;
    kind: string;
    summary: string;
    content: string;
    sha256: string;
    createdAt: number;
    sourceFiles: string[];
    freshness: 'FRESH' | 'POTENTIALLY_STALE';
}
export declare class ContextArtifactStore {
    #private;
    readonly projectRoot?: string | undefined;
    constructor(projectRoot?: string | undefined);
    add(kind: string, summary: string, content: string, sourceFiles?: string[]): DurableContextArtifact;
    get(id: string): DurableContextArtifact | undefined;
    invalidateChanged(files: string[]): number;
}
