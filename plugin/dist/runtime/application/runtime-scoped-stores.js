import { ContextArtifactStore } from '../context/artifact-store.js';
import { ProjectIntelligenceStore } from '../project-intelligence/store.js';
import { SkillCatalogIndex } from '../skills/catalog-index.js';
export function createRuntimeScopedStores(projectRoot, hiRoot) {
    return {
        contextArtifacts: new ContextArtifactStore(projectRoot),
        projectIntelligence: new ProjectIntelligenceStore(projectRoot),
        skillCatalog: new SkillCatalogIndex(projectRoot, hiRoot),
    };
}
