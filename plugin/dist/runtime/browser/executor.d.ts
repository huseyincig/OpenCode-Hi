import type { BrowserObservationContract } from '../../contracts/browser-observation.js';
export interface BrowserExecutionContext {
    task_id: string;
    executor_version: string;
    screenshot_artifact_ref?: string;
}
export interface BrowserTarget {
    value: string;
}
export interface BrowserInspectRequest {
    selector?: string;
}
export interface BrowserWaitRequest {
    milliseconds: number;
}
export interface BrowserExecutor {
    health(): Promise<{
        available: boolean;
        version?: string;
        reason?: string;
    }>;
    open(context: BrowserExecutionContext, url: string): Promise<BrowserObservationContract>;
    navigate(context: BrowserExecutionContext, url: string): Promise<BrowserObservationContract>;
    click(context: BrowserExecutionContext, target: BrowserTarget): Promise<BrowserObservationContract>;
    type(context: BrowserExecutionContext, target: BrowserTarget, value: string): Promise<BrowserObservationContract>;
    inspect(context: BrowserExecutionContext, request?: BrowserInspectRequest): Promise<BrowserObservationContract>;
    screenshot(context: BrowserExecutionContext): Promise<BrowserObservationContract>;
    wait(context: BrowserExecutionContext, request: BrowserWaitRequest): Promise<BrowserObservationContract>;
    close(context: BrowserExecutionContext): Promise<BrowserObservationContract>;
}
export interface BrowserCommandResult {
    exit_code: number;
    stdout: string;
    stderr: string;
}
export interface BrowserCommandRunner {
    run(argv: readonly string[], options: {
        cwd: string;
        timeout_ms: number;
        env?: Readonly<Record<string, string>>;
    }): Promise<BrowserCommandResult>;
}
