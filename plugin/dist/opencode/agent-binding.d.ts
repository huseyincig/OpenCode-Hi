/**
 * OpenCode adapter binding check for one canonical Hi role template.
 * The only tolerated host-side extension is an admitted project methodology
 * permission (`hi-project-*`) in the native skill permission map.
 */
export declare function matchesHiOpenCodeAgent(actual: unknown, expected: unknown): boolean;
export declare function bindHiOpenCodeAgents(hostConfig: Record<string, unknown>, packaged: Record<string, unknown>): string[];
