import { type SkillCandidate } from './registry.js';
export declare class SkillCatalogIndex {
    #private;
    readonly projectRoot: string;
    readonly hiRoot?: string | undefined;
    constructor(projectRoot: string, hiRoot?: string | undefined);
    candidates(hostConfig: Record<string, unknown>): SkillCandidate[];
    invalidate(): void;
    invalidateChanged(files: string[]): boolean;
}
