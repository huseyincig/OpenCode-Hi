export declare const ARTIFACT_RETENTION_CLASSES: readonly ["session", "project"];
export type ArtifactRetentionClass = typeof ARTIFACT_RETENTION_CLASSES[number];
export declare const ARTIFACT_PRIVACY_CLASSES: readonly ["project-private", "redacted"];
export type ArtifactPrivacyClass = typeof ARTIFACT_PRIVACY_CLASSES[number];
export declare const ARTIFACT_FRESHNESS: readonly ["FRESH", "POTENTIALLY_STALE"];
export type ArtifactFreshness = typeof ARTIFACT_FRESHNESS[number];
export interface ArtifactProvenance {
    source_files: string[];
}
export interface ArtifactContract {
    artifact_id: string;
    kind: string;
    content_ref: 'inline-body';
    content: string;
    content_hash: string;
    summary: string;
    producer: string;
    provenance: ArtifactProvenance;
    created_at: number;
    retention_class: ArtifactRetentionClass;
    privacy_class: ArtifactPrivacyClass;
    consumer_refs: string[];
    freshness: ArtifactFreshness;
}
export declare function artifactContentHash(content: string): string;
export declare function newArtifactId(): string;
export declare function isArtifactContract(v: unknown): v is ArtifactContract;
