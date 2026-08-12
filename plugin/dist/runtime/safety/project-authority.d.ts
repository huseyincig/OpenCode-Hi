export type PersistentAuthorityClass = 'git-push' | 'package-publish' | 'deploy';
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
/** Merge HHC's authority prompt/persistent grants without ever weakening a user/native explicit deny. */
export declare function applyProjectAuthorityPermissions(config: Record<string, unknown>, store: ProjectAuthorityStore): void;
