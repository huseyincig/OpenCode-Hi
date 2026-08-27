export type BrowserBackend = 'bounded-playwright' | 'mcp';
export interface BrowserBackendDecision {
    backend?: BrowserBackend;
    reason: string;
}
export declare function resolveBrowserBackend(input: {
    role: string;
    browserRequested: boolean;
    requested?: string;
    localBrowserAvailable: boolean;
    semanticCapabilities: readonly string[];
    selectedMcpServers: readonly string[];
}): BrowserBackendDecision;
export declare function normalizeBrowserAllowedOrigins(values: readonly string[]): string[];
export declare function browserOriginsFromTargets(targets: readonly string[]): string[];
export declare function browserOriginsFromText(text: string): string[];
/** Host-observed output may contain unrelated external links; only exact supported local origins are target authority candidates. */
export declare function observedLocalBrowserOriginsFromText(text: string): string[];
