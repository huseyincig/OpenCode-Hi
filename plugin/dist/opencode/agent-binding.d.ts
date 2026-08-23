export declare function isHiInjectedOpenCodeAgent(value: unknown): boolean;
/**
 * Compatibility check for a pre-existing host agent occupying a canonical Hi name.
 * Hi execution-critical semantics remain fixed. Harmless display metadata, permission
 * narrowings, and OpenCode-owned model/variant routing metadata are allowed. Foreign
 * prompt/tool/disable/options semantics or permission widening remain collisions.
 */
export declare function matchesHiOpenCodeAgent(actual: unknown, expected: unknown): boolean;
export interface HiAgentProjectionResult {
    collisions: string[];
    inserted: string[];
    compatibleExisting: string[];
}
export declare function projectHiOpenCodeAgents(hostConfig: Record<string, unknown>, packaged: Record<string, unknown>): HiAgentProjectionResult;
