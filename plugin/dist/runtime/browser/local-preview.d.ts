export interface LocalPreviewResult {
    task_id: string;
    origin: string;
    url: string;
    root: string;
    target: string;
    reused: boolean;
}
/** Task-owned, loopback-only static preview. No npm/dev-server install or project mutation. */
export declare class LocalPreviewManager {
    #private;
    private readonly workingDirectory;
    constructor(workingDirectory: string);
    start(taskID: string, targetRaw: string, scope: string[]): Promise<LocalPreviewResult>;
    stop(taskID: string): Promise<boolean>;
    dispose(): Promise<void>;
    active(taskID: string): boolean;
}
