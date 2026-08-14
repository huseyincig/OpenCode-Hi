import { type ProjectIntelligenceConsumer, type ProjectIntelligenceContract } from '../../contracts/project-intelligence.js';
import { type ProjectIntelligenceRetrievalHit } from './retrieval.js';
export declare class ProjectIntelligenceStore {
    #private;
    readonly projectRoot?: string | undefined;
    constructor(projectRoot?: string | undefined);
    upsert(item: ProjectIntelligenceContract): void;
    get(id: string): ProjectIntelligenceContract | undefined;
    retrieve(query: string, files: string[], consumer?: ProjectIntelligenceConsumer, limit?: number): ProjectIntelligenceRetrievalHit[];
    relevantToFiles(files: string[], consumer?: ProjectIntelligenceConsumer, limit?: number): ProjectIntelligenceContract[];
    invalidateChanged(changedFiles: string[], currentHashes?: Record<string, string>): string[];
    all(): ProjectIntelligenceContract[];
}
