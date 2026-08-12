export interface NativeProjectContext {
    project?: any;
    directory?: string;
    worktree?: string;
}
export declare function resolveNativeProjectRoot(fallback: string, nativeContext?: NativeProjectContext): string;
export interface RepoContext {
    root: string;
    name: string;
    ecosystems: string[];
    markers: string[];
    likelyVerification: string[];
    git: boolean;
    native: {
        directory?: string;
        worktree?: string;
        projectID?: string;
        vcs?: string;
    };
}
export declare function collectRepoContext(root: string, nativeContext?: NativeProjectContext): RepoContext;
