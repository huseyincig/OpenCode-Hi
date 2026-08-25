export interface BrowserBootstrapRunResult {
    exitCode: number | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
}
export interface BrowserBootstrapResult {
    available: boolean;
    attempted: boolean;
    cachePath: string;
    version?: string;
    executablePath?: string;
    reason?: string;
}
export interface PlaywrightBrowserBootstrapOptions {
    package_root: string;
    project_root?: string;
    cache_path?: string;
    timeout_ms?: number;
    run_process?: (command: string, args: string[], options: {
        cwd: string;
        env: Record<string, string | undefined>;
        timeoutMs: number;
    }) => Promise<BrowserBootstrapRunResult>;
    package_json_path?: string;
    cli_path?: string;
    find_executable?: (cachePath: string) => string | undefined;
}
export declare function configuredPlaywrightCoreVersion(packageRoot: string): string | undefined;
export declare function hiPlaywrightCachePath(version: string, env?: Record<string, string | undefined>, home?: string, os?: string): string;
/** One-shot, process-local, Hi-owned Chromium bootstrap. Never mutates the application project. */
export declare class PlaywrightBrowserBootstrap {
    #private;
    readonly packageRoot: string;
    readonly version?: string;
    readonly cachePath: string;
    constructor(options: PlaywrightBrowserBootstrapOptions);
    status(): BrowserBootstrapResult | undefined;
    discover(): string | undefined;
    ensure(): Promise<BrowserBootstrapResult>;
}
