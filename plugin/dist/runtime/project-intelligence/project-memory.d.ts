import type { ProjectMemoryProjection, ProjectMemoryProvider } from '../../contracts/project-memory.js';
export interface ProjectMemoryRecallOptions {
    query: string;
    max_age_ms: number;
    max_items?: number;
    max_chars?: number;
    now?: number;
}
/** Provider-backed broad project memory. This runtime owns projection only; it persists nothing. */
export declare class ProjectMemoryRuntime {
    readonly provider?: ProjectMemoryProvider | undefined;
    readonly projectRoot: string;
    constructor(projectRoot: string, provider?: ProjectMemoryProvider | undefined);
    recall(options: ProjectMemoryRecallOptions): Promise<ProjectMemoryProjection>;
}
