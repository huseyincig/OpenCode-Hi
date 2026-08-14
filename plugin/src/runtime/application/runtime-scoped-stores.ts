import { ContextArtifactStore } from '../context/artifact-store.js'
import { ProjectIntelligenceStore } from '../project-intelligence/store.js'
import { SkillCatalogIndex } from '../skills/catalog-index.js'

export interface RuntimeScopedStores {
  contextArtifacts:ContextArtifactStore
  projectIntelligence:ProjectIntelligenceStore
  skillCatalog:SkillCatalogIndex
}

export function createRuntimeScopedStores(projectRoot:string,hiRoot?:string):RuntimeScopedStores{
  return {
    contextArtifacts:new ContextArtifactStore(projectRoot),
    projectIntelligence:new ProjectIntelligenceStore(projectRoot),
    skillCatalog:new SkillCatalogIndex(projectRoot,hiRoot),
  }
}
