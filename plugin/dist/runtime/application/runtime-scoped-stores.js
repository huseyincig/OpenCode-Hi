import { ContextArtifactStore } from '../context/artifact-store.js';
import { ProjectTaskOutcomeMemoryStore } from '../project-intelligence/task-outcome-memory.js';
export function createRuntimeScopedStores(projectRoot, _hiRoot) {
    return {
        contextArtifacts: new ContextArtifactStore(projectRoot),
        taskOutcomeMemory: new ProjectTaskOutcomeMemoryStore(projectRoot),
    };
}
