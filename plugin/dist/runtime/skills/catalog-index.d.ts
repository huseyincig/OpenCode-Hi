import { type SkillCandidate, type SkillProvider, type SkillResource } from './registry.js';
export interface SkillCatalogRecord {
    skill_id: string;
    provider: SkillProvider;
    skill_path: string;
    realpath: string;
    mtime_ms: number;
    content_sha256: string;
    frontmatter: Record<string, string>;
    resource_map: SkillResource[];
    valid: boolean;
    enabled: boolean;
    orchestrationRisk: boolean;
}
export declare class SkillCatalogIndex {
    #private;
    readonly projectRoot: string;
    readonly hiRoot?: string | undefined;
    constructor(projectRoot: string, hiRoot?: string | undefined);
    refresh(hostConfig: Record<string, unknown>): SkillCatalogRecord[];
    records(hostConfig: Record<string, unknown>): SkillCatalogRecord[];
    candidates(hostConfig: Record<string, unknown>): SkillCandidate[];
    diagnostics(): {
        full_scans: number;
        fingerprint_checks: number;
        cached_records: number;
    };
    invalidate(): void;
    invalidateChanged(files: string[]): boolean;
}
