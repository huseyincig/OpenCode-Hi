export const STORAGE_SCOPES = ['project', 'global', 'runtime'];
export const STORAGE_LIFECYCLES = ['canonical', 'derived', 'cache', 'ephemeral'];
const KEYS = new Set(['data_class', 'canonical_owner', 'scope', 'lifecycle', 'path_provider', 'schema_ref', 'write_owner', 'readers', 'retention', 'privacy']);
function record(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function nonempty(v) { return typeof v === 'string' && Boolean(v.trim()); }
function stringList(v) { return Array.isArray(v) && v.length > 0 && v.every(nonempty) && new Set(v).size === v.length; }
export function isStorageOwnershipContract(v) {
    return record(v) && Object.keys(v).every(k => KEYS.has(k)) && nonempty(v.data_class) && nonempty(v.canonical_owner) && STORAGE_SCOPES.includes(v.scope) && STORAGE_LIFECYCLES.includes(v.lifecycle) && nonempty(v.path_provider) && nonempty(v.schema_ref) && nonempty(v.write_owner) && stringList(v.readers) && nonempty(v.retention) && nonempty(v.privacy);
}
export function assertStorageOwnershipCatalog(items) {
    const seen = new Set();
    for (const item of items) {
        if (!isStorageOwnershipContract(item))
            throw new Error('Invalid StorageOwnershipContract');
        const key = `${item.scope}:${item.data_class}`;
        if (seen.has(key))
            throw new Error(`Duplicate canonical storage owner: ${key}`);
        seen.add(key);
    }
}
export const STORAGE_OWNERSHIP_CATALOG = [
    { data_class: 'project-routing-policy', canonical_owner: 'hi-project-routing-policy', scope: 'project', lifecycle: 'canonical', path_provider: '.opencode/hi/policy/routing.json', schema_ref: 'hi-routing@1', write_owner: 'project-routing-policy-writer', readers: ['config-resolver', 'doctor', 'setup-cli'], retention: 'until explicit project policy change/removal', privacy: 'project-private' },
    { data_class: 'project-authority-projection', canonical_owner: 'hi-authority', scope: 'project', lifecycle: 'canonical', path_provider: '.opencode/hi/policy/authority.json', schema_ref: 'project-authority@1', write_owner: 'ProjectAuthorityStore', readers: ['permission-adapter', 'setup-cli'], retention: 'until explicit authority change/removal', privacy: 'security-sensitive' },
    { data_class: 'setup-ownership-provenance', canonical_owner: 'hi-setup', scope: 'project', lifecycle: 'canonical', path_provider: '.opencode/hi/provenance/setup.json', schema_ref: 'setup-ownership@2', write_owner: 'native-plugin-setup', readers: ['doctor', 'uninstall'], retention: 'plugin registration ownership lifetime', privacy: 'project-private' },
    { data_class: 'project-methodology-candidate', canonical_owner: 'hi-project-methodology-learning', scope: 'project', lifecycle: 'derived', path_provider: '.opencode/hi/project-intelligence/methodology-candidates/<id>.json', schema_ref: 'ProjectMethodologyCandidate@1', write_owner: 'ProjectMethodologyLearningStore', readers: ['project-methodology-admission', 'methodology-catalog'], retention: 'candidate lifecycle through archive/admission', privacy: 'project-private' },
    { data_class: 'project-task-outcome-memory', canonical_owner: 'hi-project-task-outcome-memory', scope: 'project', lifecycle: 'derived', path_provider: '.opencode/hi/project-intelligence/task-outcomes.jsonl', schema_ref: 'TaskOutcomeMemoryRecord@1', write_owner: 'ProjectTaskOutcomeMemoryStore', readers: ['ProjectTaskOutcomeMemoryStore', 'TaskRuntime'], retention: 'bounded newest 128 accepted task outcome receipts', privacy: 'project-private; no raw provider payload or free-form result prose' },
    { data_class: 'durable-context-artifact', canonical_owner: 'hi-context-artifact', scope: 'project', lifecycle: 'derived', path_provider: '.opencode/hi/artifacts/<kind>/<artifact_id>.json + optional hash-bound binary sibling', schema_ref: 'ArtifactContract', write_owner: 'ContextArtifactStore', readers: ['ContextArtifactStore', 'TaskRuntime'], retention: 'artifact retention_class', privacy: 'artifact privacy_class' },
    { data_class: 'project-methodology-policy', canonical_owner: 'project-methodology', scope: 'project', lifecycle: 'canonical', path_provider: '.opencode/hi/policy/methodologies/<name>.json', schema_ref: 'ProjectMethodologyPolicy@1', write_owner: 'authorized-project-methodology-edit', readers: ['project-methodology-admission', 'methodology-catalog'], retention: 'project methodology lifetime', privacy: 'project-private' },
    { data_class: 'project-methodology-provenance', canonical_owner: 'project-methodology', scope: 'project', lifecycle: 'canonical', path_provider: '.opencode/hi/provenance/methodologies/<name>.json', schema_ref: 'ProjectMethodologyProvenance@1', write_owner: 'authorized-project-methodology-edit', readers: ['project-methodology-admission', 'methodology-catalog'], retention: 'project methodology lifetime', privacy: 'project-private' },
    { data_class: 'project-methodology-skill', canonical_owner: 'OpenCode-project-skill', scope: 'project', lifecycle: 'canonical', path_provider: '.opencode/skills/hi-project-<purpose>/**', schema_ref: 'OpenCode SKILL.md + project methodology contract', write_owner: 'authorized-project-methodology-edit', readers: ['OpenCode-skill-discovery', 'project-methodology-admission', 'TaskRuntime'], retention: 'project methodology lifetime', privacy: 'project-private' },
    { data_class: 'mission-survival-state', canonical_owner: 'hi-runtime', scope: 'runtime', lifecycle: 'ephemeral', path_provider: 'runtimeStatePath(projectRoot) -> OS state/opencode-hi/projects/<project-hash>/runtime-state.json', schema_ref: 'RUNTIME_STATE_SCHEMA', write_owner: 'RuntimePersistence', readers: ['RuntimePersistence', 'doctor'], retention: 'bounded restart survival; clean shutdown/runtime cleanup', privacy: 'operational-private' },
];
assertStorageOwnershipCatalog(STORAGE_OWNERSHIP_CATALOG);
