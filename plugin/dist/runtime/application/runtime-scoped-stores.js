import { ContextArtifactStore } from '../context/artifact-store.js';
import { ProjectIntelligenceRuntime } from '../project-intelligence/runtime.js';
export function createRuntimeScopedStores(projectRoot, _hiRoot) {
    const projectIntelligence = new ProjectIntelligenceRuntime(projectRoot);
    return {
        contextArtifacts: new ContextArtifactStore(projectRoot),
        projectIntelligence,
        // Compatibility projection for existing runtime consumers. This is the
        // exact same store instance owned by ProjectIntelligenceRuntime.
        taskOutcomeMemory: projectIntelligence.taskOutcomeMemory,
    };
}
