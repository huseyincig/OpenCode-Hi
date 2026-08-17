export declare const STORAGE_SCOPES: readonly ["project", "global", "runtime"];
export declare const STORAGE_LIFECYCLES: readonly ["canonical", "derived", "cache", "ephemeral"];
export type StorageScope = typeof STORAGE_SCOPES[number];
export type StorageLifecycle = typeof STORAGE_LIFECYCLES[number];
export interface StorageOwnershipContract {
    data_class: string;
    canonical_owner: string;
    scope: StorageScope;
    lifecycle: StorageLifecycle;
    path_provider: string;
    schema_ref: string;
    write_owner: string;
    readers: readonly string[];
    retention: string;
    privacy: string;
}
export declare function isStorageOwnershipContract(v: unknown): v is StorageOwnershipContract;
export declare function assertStorageOwnershipCatalog(items: readonly unknown[]): asserts items is readonly StorageOwnershipContract[];
export declare const STORAGE_OWNERSHIP_CATALOG: readonly [{
    readonly data_class: "project-routing-policy";
    readonly canonical_owner: "hi-project-routing-policy";
    readonly scope: "project";
    readonly lifecycle: "canonical";
    readonly path_provider: ".opencode/hi/policy/routing.json";
    readonly schema_ref: "hi-routing@1";
    readonly write_owner: "project-routing-policy-writer";
    readonly readers: readonly ["config-resolver", "doctor", "setup-cli"];
    readonly retention: "until explicit project policy change/removal";
    readonly privacy: "project-private";
}, {
    readonly data_class: "project-authority-projection";
    readonly canonical_owner: "hi-authority";
    readonly scope: "project";
    readonly lifecycle: "canonical";
    readonly path_provider: ".opencode/hi/policy/authority.json";
    readonly schema_ref: "project-authority@1";
    readonly write_owner: "ProjectAuthorityStore";
    readonly readers: readonly ["permission-adapter", "setup-cli"];
    readonly retention: "until explicit authority change/removal";
    readonly privacy: "security-sensitive";
}, {
    readonly data_class: "setup-ownership-provenance";
    readonly canonical_owner: "hi-setup";
    readonly scope: "project";
    readonly lifecycle: "canonical";
    readonly path_provider: ".opencode/hi/provenance/setup.json";
    readonly schema_ref: "setup-ownership@2";
    readonly write_owner: "native-plugin-setup";
    readonly readers: readonly ["doctor", "uninstall"];
    readonly retention: "plugin registration ownership lifetime";
    readonly privacy: "project-private";
}, {
    readonly data_class: "project-methodology-candidate";
    readonly canonical_owner: "hi-project-methodology-learning";
    readonly scope: "project";
    readonly lifecycle: "derived";
    readonly path_provider: ".opencode/hi/project-intelligence/methodology-candidates/<id>.json";
    readonly schema_ref: "ProjectMethodologyCandidate@1";
    readonly write_owner: "ProjectMethodologyLearningStore";
    readonly readers: readonly ["project-methodology-admission", "methodology-catalog"];
    readonly retention: "candidate lifecycle through archive/admission";
    readonly privacy: "project-private";
}, {
    readonly data_class: "durable-context-artifact";
    readonly canonical_owner: "hi-context-artifact";
    readonly scope: "project";
    readonly lifecycle: "derived";
    readonly path_provider: ".opencode/hi/artifacts/<kind>/<artifact_id>.json + optional hash-bound binary sibling";
    readonly schema_ref: "ArtifactContract";
    readonly write_owner: "ContextArtifactStore";
    readonly readers: readonly ["ContextArtifactStore", "TaskRuntime"];
    readonly retention: "artifact retention_class";
    readonly privacy: "artifact privacy_class";
}, {
    readonly data_class: "project-methodology-policy";
    readonly canonical_owner: "project-methodology";
    readonly scope: "project";
    readonly lifecycle: "canonical";
    readonly path_provider: ".opencode/hi/policy/methodologies/<name>.json";
    readonly schema_ref: "ProjectMethodologyPolicy@1";
    readonly write_owner: "authorized-project-methodology-edit";
    readonly readers: readonly ["project-methodology-admission", "methodology-catalog"];
    readonly retention: "project methodology lifetime";
    readonly privacy: "project-private";
}, {
    readonly data_class: "project-methodology-provenance";
    readonly canonical_owner: "project-methodology";
    readonly scope: "project";
    readonly lifecycle: "canonical";
    readonly path_provider: ".opencode/hi/provenance/methodologies/<name>.json";
    readonly schema_ref: "ProjectMethodologyProvenance@1";
    readonly write_owner: "authorized-project-methodology-edit";
    readonly readers: readonly ["project-methodology-admission", "methodology-catalog"];
    readonly retention: "project methodology lifetime";
    readonly privacy: "project-private";
}, {
    readonly data_class: "project-methodology-skill";
    readonly canonical_owner: "OpenCode-project-skill";
    readonly scope: "project";
    readonly lifecycle: "canonical";
    readonly path_provider: ".opencode/skills/hi-project-<purpose>/**";
    readonly schema_ref: "OpenCode SKILL.md + project methodology contract";
    readonly write_owner: "authorized-project-methodology-edit";
    readonly readers: readonly ["OpenCode-skill-discovery", "project-methodology-admission", "TaskRuntime"];
    readonly retention: "project methodology lifetime";
    readonly privacy: "project-private";
}, {
    readonly data_class: "mission-survival-state";
    readonly canonical_owner: "hi-runtime";
    readonly scope: "runtime";
    readonly lifecycle: "ephemeral";
    readonly path_provider: "runtimeStatePath(projectRoot) -> OS state/opencode-hi/projects/<project-hash>/runtime-state.json";
    readonly schema_ref: "RUNTIME_STATE_SCHEMA";
    readonly write_owner: "RuntimePersistence";
    readonly readers: readonly ["RuntimePersistence", "doctor"];
    readonly retention: "bounded restart survival; clean shutdown/runtime cleanup";
    readonly privacy: "operational-private";
}];
