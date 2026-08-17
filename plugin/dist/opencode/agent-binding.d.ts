export declare function isHiInjectedOpenCodeAgent(value: unknown): boolean;
/**
 * Compatibility check for a pre-existing host agent occupying a canonical Hi name.
 * Hi execution-critical semantics remain fixed, while harmless display metadata and
 * permission narrowings are allowed. Permission widening or host-level model/tool
 * constraints are collisions because they can invalidate Hi routing/authority semantics.
 */
export declare function matchesHiOpenCodeAgent(actual: unknown, expected: unknown): boolean;
export interface HiAgentProjectionResult {
    collisions: string[];
    inserted: string[];
    compatibleExisting: string[];
}
export declare function projectHiOpenCodeAgents(hostConfig: Record<string, unknown>, packaged: Record<string, unknown>): HiAgentProjectionResult;
/** Backward-compatible helper retained for narrow callers/tests. */
export declare function bindHiOpenCodeAgents(hostConfig: Record<string, unknown>, packaged: Record<string, unknown>): string[];
