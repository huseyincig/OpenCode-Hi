import { type ProjectIntelligenceConsumer, type ProjectIntelligenceContract } from '../../contracts/project-intelligence.js';
export declare class ProjectIntelligenceStore {
    #private;
    readonly projectRoot?: string | undefined;
    constructor(projectRoot?: string | undefined);
    upsert(item: ProjectIntelligenceContract): void;
    get(id: string): ProjectIntelligenceContract | undefined;
    relevantToFiles(files: string[], consumer?: ProjectIntelligenceConsumer, limit?: number): ProjectIntelligenceContract[];
    invalidateChanged(changedFiles: string[], currentHashes?: Record<string, string>): string[];
    all(): ProjectIntelligenceContract[];
}
