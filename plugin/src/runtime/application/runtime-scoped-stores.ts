import { ContextArtifactStore } from '../context/artifact-store.js'

export interface RuntimeScopedStores {
  contextArtifacts:ContextArtifactStore
}

export function createRuntimeScopedStores(projectRoot:string,_hiRoot?:string):RuntimeScopedStores{
  return {
    contextArtifacts:new ContextArtifactStore(projectRoot),
  }
}
