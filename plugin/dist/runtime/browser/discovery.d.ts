export declare function defaultPlaywrightCacheRoots(extraRoots?: readonly string[]): string[];
export declare function discoverChromiumInRoots(roots: readonly string[], exists?: (path: string) => boolean): string | undefined;
export declare function discoverPlaywrightChromium(exists?: (path: string) => boolean, extraRoots?: readonly string[]): string | undefined;
