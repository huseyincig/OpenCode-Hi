import { ContextArtifactStore } from '../context/artifact-store.js';
export function createRuntimeScopedStores(projectRoot, _hiRoot) {
    return {
        contextArtifacts: new ContextArtifactStore(projectRoot),
    };
}
