export const STORAGE_SCOPES=['project','global','runtime'] as const
export const STORAGE_LIFECYCLES=['canonical','derived','cache','ephemeral'] as const
export type StorageScope=typeof STORAGE_SCOPES[number]
export type StorageLifecycle=typeof STORAGE_LIFECYCLES[number]

export interface StorageOwnershipContract{
  data_class:string
  canonical_owner:string
  scope:StorageScope
  lifecycle:StorageLifecycle
  path_provider:string
  schema_ref:string
  write_owner:string
  readers:readonly string[]
  retention:string
  privacy:string
}

const KEYS=new Set(['data_class','canonical_owner','scope','lifecycle','path_provider','schema_ref','write_owner','readers','retention','privacy'])
function record(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function nonempty(v:unknown):v is string{return typeof v==='string'&&Boolean(v.trim())}
function stringList(v:unknown):v is string[]{return Array.isArray(v)&&v.length>0&&v.every(nonempty)&&new Set(v).size===v.length}
export function isStorageOwnershipContract(v:unknown):v is StorageOwnershipContract{
  return record(v)&&Object.keys(v).every(k=>KEYS.has(k))&&nonempty(v.data_class)&&nonempty(v.canonical_owner)&&(STORAGE_SCOPES as readonly unknown[]).includes(v.scope)&&(STORAGE_LIFECYCLES as readonly unknown[]).includes(v.lifecycle)&&nonempty(v.path_provider)&&nonempty(v.schema_ref)&&nonempty(v.write_owner)&&stringList(v.readers)&&nonempty(v.retention)&&nonempty(v.privacy)
}

export function assertStorageOwnershipCatalog(items:readonly unknown[]):asserts items is readonly StorageOwnershipContract[]{
  const seen=new Set<string>()
  for(const item of items){
    if(!isStorageOwnershipContract(item))throw new Error('Invalid StorageOwnershipContract')
    const key=`${item.scope}:${item.data_class}`
    if(seen.has(key))throw new Error(`Duplicate canonical storage owner: ${key}`)
    seen.add(key)
  }
}

export const STORAGE_OWNERSHIP_CATALOG=[
  {data_class:'project-routing-policy',canonical_owner:'hi-project-routing-policy',scope:'project',lifecycle:'canonical',path_provider:'.opencode/hi/policy/routing.json',schema_ref:'hi-routing@1',write_owner:'project-routing-policy-writer',readers:['config-resolver','doctor','setup-cli'],retention:'until explicit project policy change/removal',privacy:'project-private'},
  {data_class:'project-authority-projection',canonical_owner:'hi-authority',scope:'project',lifecycle:'canonical',path_provider:'.opencode/hi/policy/authority.json',schema_ref:'project-authority@1',write_owner:'ProjectAuthorityStore',readers:['permission-adapter','setup-cli'],retention:'until explicit authority change/removal',privacy:'security-sensitive'},
  {data_class:'setup-ownership-provenance',canonical_owner:'hi-setup',scope:'project',lifecycle:'canonical',path_provider:'.opencode/hi/provenance/setup.json',schema_ref:'setup-ownership@2',write_owner:'native-plugin-setup',readers:['doctor','uninstall'],retention:'plugin registration ownership lifetime',privacy:'project-private'},
  {data_class:'project-intelligence-pattern',canonical_owner:'hi-project-intelligence',scope:'project',lifecycle:'derived',path_provider:'.opencode/hi/project-intelligence/patterns/<id>.json',schema_ref:'ProjectIntelligenceContract',write_owner:'ProjectIntelligenceStore',readers:['ProjectIntelligenceStore','TaskRuntime'],retention:'project reusable knowledge lifecycle',privacy:'project-private'},
  {data_class:'project-methodology-candidate',canonical_owner:'hi-project-methodology-learning',scope:'project',lifecycle:'derived',path_provider:'.opencode/hi/project-intelligence/methodology-candidates/<id>.json',schema_ref:'ProjectMethodologyCandidate@1',write_owner:'ProjectMethodologyLearningStore',readers:['project-methodology-admission','methodology-catalog'],retention:'candidate lifecycle through archive/admission',privacy:'project-private'},
  {data_class:'durable-context-artifact',canonical_owner:'hi-context-artifact',scope:'project',lifecycle:'derived',path_provider:'.opencode/hi/artifacts/<kind>/<artifact_id>.json + optional hash-bound binary sibling',schema_ref:'ArtifactContract',write_owner:'ContextArtifactStore',readers:['ContextArtifactStore','TaskRuntime'],retention:'artifact retention_class',privacy:'artifact privacy_class'},
  {data_class:'project-methodology-policy',canonical_owner:'project-methodology',scope:'project',lifecycle:'canonical',path_provider:'.opencode/hi/policy/methodologies/<name>.json',schema_ref:'ProjectMethodologyPolicy@1',write_owner:'authorized-project-methodology-edit',readers:['project-methodology-admission','methodology-catalog'],retention:'project methodology lifetime',privacy:'project-private'},
  {data_class:'project-methodology-provenance',canonical_owner:'project-methodology',scope:'project',lifecycle:'canonical',path_provider:'.opencode/hi/provenance/methodologies/<name>.json',schema_ref:'ProjectMethodologyProvenance@1',write_owner:'authorized-project-methodology-edit',readers:['project-methodology-admission','methodology-catalog'],retention:'project methodology lifetime',privacy:'project-private'},
  {data_class:'project-methodology-skill',canonical_owner:'OpenCode-project-skill',scope:'project',lifecycle:'canonical',path_provider:'.opencode/skills/hi-project-<purpose>/**',schema_ref:'OpenCode SKILL.md + project methodology contract',write_owner:'authorized-project-methodology-edit',readers:['OpenCode-skill-discovery','project-methodology-admission','TaskRuntime'],retention:'project methodology lifetime',privacy:'project-private'},
  {data_class:'mission-survival-state',canonical_owner:'hi-runtime',scope:'runtime',lifecycle:'ephemeral',path_provider:'runtimeStatePath(projectRoot) -> OS state/opencode-hi/projects/<project-hash>/runtime-state.json',schema_ref:'RUNTIME_STATE_SCHEMA',write_owner:'RuntimePersistence',readers:['RuntimePersistence','doctor'],retention:'bounded restart survival; clean shutdown/runtime cleanup',privacy:'operational-private'},
] as const satisfies readonly StorageOwnershipContract[]

assertStorageOwnershipCatalog(STORAGE_OWNERSHIP_CATALOG)
