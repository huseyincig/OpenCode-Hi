import { ContextArtifactStore } from '../context/artifact-store.js'
import { ProjectTaskOutcomeMemoryStore } from '../project-intelligence/task-outcome-memory.js'
import { ProjectIntelligenceRuntime } from '../project-intelligence/runtime.js'

export interface RuntimeScopedStores {
  contextArtifacts:ContextArtifactStore
  projectIntelligence:ProjectIntelligenceRuntime
  taskOutcomeMemory:ProjectTaskOutcomeMemoryStore
}

export function createRuntimeScopedStores(projectRoot:string,_hiRoot?:string):RuntimeScopedStores{
  const projectIntelligence=new ProjectIntelligenceRuntime(projectRoot)
  return {
    contextArtifacts:new ContextArtifactStore(projectRoot),
    projectIntelligence,
    // Compatibility projection for existing runtime consumers. This is the
    // exact same store instance owned by ProjectIntelligenceRuntime.
    taskOutcomeMemory:projectIntelligence.taskOutcomeMemory,
  }
}
