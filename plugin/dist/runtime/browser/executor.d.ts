import type { BrowserObservationContract } from '../../contracts/browser-observation.js';
export interface BrowserExecutionContext {
    task_id: string;
    execution_owner_ref: string;
    executor_version: string;
    allowed_origins: string[];
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
export interface BrowserKeyRequest {
    key: string;
}
export type BrowserCleanupReason = 'cleaned' | 'not-found' | 'owner-mismatch' | 'close-failed';
export interface BrowserCleanupResult {
    cleaned: boolean;
    reason: BrowserCleanupReason;
    error?: string;
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
    key(context: BrowserExecutionContext, request: BrowserKeyRequest): Promise<BrowserObservationContract>;
    inspect(context: BrowserExecutionContext, request?: BrowserInspectRequest): Promise<BrowserObservationContract>;
    screenshot(context: BrowserExecutionContext): Promise<BrowserObservationContract>;
    wait(context: BrowserExecutionContext, request: BrowserWaitRequest): Promise<BrowserObservationContract>;
    close(context: BrowserExecutionContext): Promise<BrowserObservationContract>;
    cleanup(context: BrowserExecutionContext): Promise<BrowserCleanupResult>;
}
export declare const HI_BROWSER_EXECUTION_TOOL_IDS: readonly ["hi_browser_preview_open", "hi_browser_open", "hi_browser_navigate", "hi_browser_click", "hi_browser_type", "hi_browser_key", "hi_browser_inspect", "hi_browser_screenshot", "hi_browser_wait", "hi_browser_close"];
