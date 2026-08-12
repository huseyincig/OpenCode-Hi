export interface WorktreeState {
    branch: string;
    path: string;
    baseRef: string;
    createdAt: number;
    status: 'active' | 'removed';
}
export declare class WorktreeRuntime {
    #private;
    private repoRoot;
    private worktreeRoot;
    constructor(repoRoot: string, worktreeRoot: string);
    create(branchInput: string, baseRef?: string): WorktreeState;
    remove(branchInput: string): boolean;
    get(branch: string): WorktreeState | undefined;
    list(): WorktreeState[];
}
