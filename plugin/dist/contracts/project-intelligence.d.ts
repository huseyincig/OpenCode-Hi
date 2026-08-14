export declare const PROJECT_INTELLIGENCE_FRESHNESS: readonly ["FRESH", "POTENTIALLY_STALE"];
export declare const PROJECT_INTELLIGENCE_LIFECYCLES: readonly ["ACTIVE", "SUPERSEDED", "ARCHIVED"];
export declare const PROJECT_INTELLIGENCE_CONSUMERS: readonly ["task-context"];
export type ProjectIntelligenceFreshness = typeof PROJECT_INTELLIGENCE_FRESHNESS[number];
export type ProjectIntelligenceLifecycle = typeof PROJECT_INTELLIGENCE_LIFECYCLES[number];
export type ProjectIntelligenceConsumer = typeof PROJECT_INTELLIGENCE_CONSUMERS[number];
export interface ProjectIntelligenceSourceRef {
    ref: string;
    hash: string;
}
export interface ProjectIntelligenceContract {
    id: string;
    statement: string;
    source_refs: ProjectIntelligenceSourceRef[];
    observed_commit?: string;
    confidence: number;
    freshness: ProjectIntelligenceFreshness;
    lifecycle: ProjectIntelligenceLifecycle;
    consumer_domains: ProjectIntelligenceConsumer[];
    updated_at: number;
}
export declare function isProjectIntelligenceContract(v: unknown): v is ProjectIntelligenceContract;
export declare function projectIntelligenceFiles(v: ProjectIntelligenceContract): string[];
