import type { ExternalActionType } from '../../contracts/external-action.js';
export type PersistentAuthorityClass = ExternalActionType;
export declare class ProjectAuthorityStore {
    #private;
    readonly path: string;
    constructor(root: string);
    has(cls: PersistentAuthorityClass): boolean;
    grant(cls: PersistentAuthorityClass): void;
    grants(): PersistentAuthorityClass[];
}
export declare function authorityClassForPatterns(patterns: string[]): PersistentAuthorityClass | undefined;
export declare function authorityPatterns(cls: PersistentAuthorityClass): string[];
/** Merge Hi's authority prompt/persistent grants without ever weakening a user/native explicit deny. */
export declare function applyProjectAuthorityPermissions(config: Record<string, unknown>, store: ProjectAuthorityStore): void;
