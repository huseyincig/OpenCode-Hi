import { type BrowserObservationContract } from '../contracts/browser-observation.js';
import type { BrowserCleanupResult, BrowserExecutionContext, BrowserExecutor, BrowserInspectRequest, BrowserTarget, BrowserWaitRequest } from '../runtime/browser/executor.js';
export { discoverPlaywrightChromium } from '../runtime/browser/discovery.js';
export interface PlaywrightBrowserAdapterOptions {
    executable_path?: string;
    headless?: boolean;
    timeout_ms?: number;
    persist_screenshot?: (bytes: Uint8Array, context: BrowserExecutionContext) => string;
    load_playwright?: () => Promise<any>;
    executable_exists?: (path: string) => boolean;
    browser_cache_paths?: string[];
}
export declare class PlaywrightBrowserAdapter implements BrowserExecutor {
    private executablePath?;
    private readonly explicitExecutable;
    private readonly browserCachePaths;
    private readonly headless;
    private readonly timeoutMs;
    private readonly persistScreenshot?;
    private readonly loadPlaywright;
    private readonly executableExists;
    private readonly sessions;
    constructor(options?: PlaywrightBrowserAdapterOptions);
    private refreshExecutable;
    private ensure;
    private observation;
    private snapshot;
    health(): Promise<{
        available: boolean;
        reason: string;
        version?: undefined;
    } | {
        available: boolean;
        version: string;
        reason?: undefined;
    }>;
    open(c: BrowserExecutionContext, url: string): Promise<BrowserObservationContract>;
    navigate(c: BrowserExecutionContext, url: string): Promise<BrowserObservationContract>;
    click(c: BrowserExecutionContext, target: BrowserTarget): Promise<BrowserObservationContract>;
    type(c: BrowserExecutionContext, target: BrowserTarget, value: string): Promise<BrowserObservationContract>;
    inspect(c: BrowserExecutionContext, request?: BrowserInspectRequest): Promise<BrowserObservationContract>;
    screenshot(c: BrowserExecutionContext): Promise<BrowserObservationContract>;
    wait(c: BrowserExecutionContext, request: BrowserWaitRequest): Promise<BrowserObservationContract>;
    close(c: BrowserExecutionContext): Promise<BrowserObservationContract>;
    cleanup(c: BrowserExecutionContext): Promise<BrowserCleanupResult>;
    dispose(): Promise<void>;
}
