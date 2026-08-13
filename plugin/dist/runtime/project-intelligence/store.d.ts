export type ProjectPatternLifecycle = 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED';
export type ProjectPatternFreshness = 'FRESH' | 'POTENTIALLY_STALE';
export interface ProjectPattern {
    id: string;
    statement: string;
    sourceFiles: string[];
    sourceHashes: Record<string, string>;
    observedCommit?: string;
    confidence: number;
    freshness: ProjectPatternFreshness;
    lifecycle: ProjectPatternLifecycle;
    updatedAt: number;
}
export declare class ProjectIntelligenceStore {
    #private;
    readonly projectRoot?: string | undefined;
    constructor(projectRoot?: string | undefined);
    upsert(pattern: ProjectPattern): void;
    get(id: string): ProjectPattern | undefined;
    relevantToFiles(files: string[], limit?: number): ProjectPattern[];
    invalidateChanged(changedFiles: string[], currentHashes?: Record<string, string>): string[];
    all(): ProjectPattern[];
}
