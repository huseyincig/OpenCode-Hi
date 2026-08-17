import { ContextArtifactStore } from '../context/artifact-store.js';
export interface RuntimeScopedStores {
    contextArtifacts: ContextArtifactStore;
}
export declare function createRuntimeScopedStores(projectRoot: string, _hiRoot?: string): RuntimeScopedStores;
