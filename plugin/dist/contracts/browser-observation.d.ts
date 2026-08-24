export declare const BROWSER_OBSERVATION_ACTIONS: readonly ["open", "navigate", "click", "type", "key", "inspect", "viewport", "screenshot", "wait", "close"];
export type BrowserObservationAction = typeof BROWSER_OBSERVATION_ACTIONS[number];
export declare const BROWSER_OBSERVATION_RESULTS: readonly ["OBSERVED", "FAILED"];
export type BrowserObservationResult = typeof BROWSER_OBSERVATION_RESULTS[number];
export interface BrowserViewport {
    width: number;
    height: number;
}
export interface BrowserObservationContract {
    observation_id: string;
    task_id: string;
    executor_version: string;
    url: string;
    action: BrowserObservationAction;
    timestamp: number;
    viewport?: BrowserViewport;
    document_identity?: string;
    dom_summary?: string;
    console_errors: string[];
    network_errors: string[];
    screenshot_artifact_ref?: string;
    result: BrowserObservationResult;
}
export declare function browserObservationId(input: {
    task_id: string;
    executor_version: string;
    url: string;
    action: BrowserObservationAction;
    timestamp: number;
    viewport?: BrowserViewport;
    document_identity?: string;
    screenshot_artifact_ref?: string;
    result: BrowserObservationResult;
}): string;
export declare function isBrowserObservationContract(v: unknown): v is BrowserObservationContract;
