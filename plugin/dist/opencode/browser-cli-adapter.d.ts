import { type BrowserObservationContract } from '../contracts/browser-observation.js';
import type { BrowserCommandRunner, BrowserExecutionContext, BrowserExecutor, BrowserInspectRequest, BrowserTarget, BrowserWaitRequest } from '../runtime/browser/executor.js';
export interface BrowserCliAdapterOptions {
    runner: BrowserCommandRunner;
    cwd: string;
    executable?: string;
    session_id: string;
    allowed_origins: readonly string[];
    timeout_ms?: number;
}
export declare class BrowserCliAdapter implements BrowserExecutor {
    private readonly runner;
    private readonly cwd;
    private readonly executable;
    private readonly sessionId;
    private readonly allowedOrigins;
    private readonly timeoutMs;
    private currentUrl?;
    constructor(options: BrowserCliAdapterOptions);
    private command;
    health(): Promise<{
        available: boolean;
        version?: string;
        reason?: string;
    }>;
    open(c: BrowserExecutionContext, url: string): Promise<BrowserObservationContract>;
    navigate(c: BrowserExecutionContext, url: string): Promise<BrowserObservationContract>;
    click(c: BrowserExecutionContext, target: BrowserTarget): Promise<BrowserObservationContract>;
    type(c: BrowserExecutionContext, target: BrowserTarget, value: string): Promise<BrowserObservationContract>;
    inspect(c: BrowserExecutionContext, request?: BrowserInspectRequest): Promise<BrowserObservationContract>;
    screenshot(c: BrowserExecutionContext): Promise<BrowserObservationContract>;
    wait(c: BrowserExecutionContext, request: BrowserWaitRequest): Promise<BrowserObservationContract>;
    close(c: BrowserExecutionContext): Promise<BrowserObservationContract>;
}
