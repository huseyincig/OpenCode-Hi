import type { BrowserExecutor, BrowserExecutionContext, BrowserInspectRequest, BrowserTarget, BrowserWaitRequest } from './executor.js';
export declare class BrowserRuntime {
    private readonly executor;
    constructor(executor: BrowserExecutor);
    health(): Promise<{
        available: boolean;
        version?: string;
        reason?: string;
    }>;
    open(c: BrowserExecutionContext, url: string): Promise<import("../../contracts/browser-observation.js").BrowserObservationContract>;
    navigate(c: BrowserExecutionContext, url: string): Promise<import("../../contracts/browser-observation.js").BrowserObservationContract>;
    click(c: BrowserExecutionContext, target: BrowserTarget): Promise<import("../../contracts/browser-observation.js").BrowserObservationContract>;
    type(c: BrowserExecutionContext, target: BrowserTarget, value: string): Promise<import("../../contracts/browser-observation.js").BrowserObservationContract>;
    inspect(c: BrowserExecutionContext, request?: BrowserInspectRequest): Promise<import("../../contracts/browser-observation.js").BrowserObservationContract>;
    screenshot(c: BrowserExecutionContext): Promise<import("../../contracts/browser-observation.js").BrowserObservationContract>;
    wait(c: BrowserExecutionContext, request: BrowserWaitRequest): Promise<import("../../contracts/browser-observation.js").BrowserObservationContract>;
    close(c: BrowserExecutionContext): Promise<import("../../contracts/browser-observation.js").BrowserObservationContract>;
    dispose(): Promise<void>;
}
