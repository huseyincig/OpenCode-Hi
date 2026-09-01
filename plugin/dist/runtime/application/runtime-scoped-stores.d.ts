import { ContextArtifactStore } from '../context/artifact-store.js';
import { ProjectTaskOutcomeMemoryStore } from '../project-intelligence/task-outcome-memory.js';
import { ProjectIntelligenceRuntime } from '../project-intelligence/runtime.js';
import type { ProjectMemoryProvider } from '../../contracts/project-memory.js';
export interface RuntimeScopedStores {
    contextArtifacts: ContextArtifactStore;
    projectIntelligence: ProjectIntelligenceRuntime;
    taskOutcomeMemory: ProjectTaskOutcomeMemoryStore;
}
export declare function createRuntimeScopedStores(projectRoot: string, _hiRoot?: string, projectMemoryProvider?: ProjectMemoryProvider): RuntimeScopedStores;
