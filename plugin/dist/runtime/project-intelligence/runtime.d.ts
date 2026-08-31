import { ProjectMethodologyLearningStore } from './methodology-learning.js';
import { ProjectTaskOutcomeMemoryStore } from './task-outcome-memory.js';
/**
 * Application-composition facade for Project Intelligence.
 *
 * The facade owns composition only. Each derived data class keeps its
 * existing storage owner and contract; this must not become a generic
 * project-memory store or a second Mission/Evidence/Context truth source.
 */
export declare class ProjectIntelligenceRuntime {
    readonly projectRoot: string;
    readonly methodologyLearning: ProjectMethodologyLearningStore;
    readonly taskOutcomeMemory: ProjectTaskOutcomeMemoryStore;
    constructor(projectRoot: string);
}
