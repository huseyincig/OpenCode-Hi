export interface DurableArtifact {
    id: string;
    kind: string;
    summary: string;
    content: string;
    sha256: string;
    createdAt: number;
    sourceHash?: string;
    freshness: 'FRESH' | 'POTENTIALLY_STALE';
}
export declare class ArtifactStore {
    #private;
    readonly projectRoot?: string | undefined;
    constructor(projectRoot?: string | undefined);
    add(kind: string, summary: string, content: string, sourceHash?: string): DurableArtifact;
    get(id: string): DurableArtifact | undefined;
    markStaleBySource(sourceHash: string): number;
}
