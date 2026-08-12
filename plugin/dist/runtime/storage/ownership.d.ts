export type ProjectStorageKind = 'POLICY' | 'PROVENANCE' | 'PROJECT_INTELLIGENCE' | 'DURABLE_ARTIFACT' | 'PROJECT_SKILL';
export declare function hiProjectRoot(projectRoot: string): string;
export declare function projectPolicyPath(projectRoot: string, name: string): string;
export declare function projectProvenancePath(projectRoot: string, name: string): string;
export declare function projectIntelligencePath(projectRoot: string, id: string): string;
export declare function durableArtifactPath(projectRoot: string, kind: string, id: string): string;
export declare function projectSkillRoot(projectRoot: string, skillName: string): string;
export declare function storageLocation(projectRoot: string, kind: ProjectStorageKind, name: string, secondary?: string): string;
