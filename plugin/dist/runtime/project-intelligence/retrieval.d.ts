import { type ProjectIntelligenceConsumer, type ProjectIntelligenceContract } from '../../contracts/project-intelligence.js';
export interface ProjectIntelligenceRetrievalQuery {
    query: string;
    files: string[];
    consumer: ProjectIntelligenceConsumer;
    limit?: number;
}
export interface ProjectIntelligenceRetrievalHit {
    item: ProjectIntelligenceContract;
    score: number;
    signals: {
        lexical: number;
        path: number;
        graph: number;
        confidence: number;
    };
}
export declare function retrieveProjectIntelligence(items: ProjectIntelligenceContract[], input: ProjectIntelligenceRetrievalQuery): ProjectIntelligenceRetrievalHit[];
