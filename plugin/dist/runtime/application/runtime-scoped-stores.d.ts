import { ContextArtifactStore } from '../context/artifact-store.js';
import { ProjectTaskOutcomeMemoryStore } from '../project-intelligence/task-outcome-memory.js';
export interface RuntimeScopedStores {
    contextArtifacts: ContextArtifactStore;
    taskOutcomeMemory: ProjectTaskOutcomeMemoryStore;
}
export declare function createRuntimeScopedStores(projectRoot: string, _hiRoot?: string): RuntimeScopedStores;
