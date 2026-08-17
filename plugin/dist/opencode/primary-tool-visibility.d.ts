/**
 * Hi tools that are registered for host/user access but are not part of the
 * provider-visible built-in primary execution surface. Browser tools are
 * child-visual-only by runtime ownership. Diagnostics remain callable through
 * the plugin surface but do not need to consume model tool-schema context.
 */
export declare const HI_PRIMARY_HIDDEN_TOOL_IDS: readonly ["hi_doctor", "hi_status", "hi_metrics", "hi_ledger", "hi_readiness", "hi_browser_open", "hi_browser_navigate", "hi_browser_click", "hi_browser_type", "hi_browser_inspect", "hi_browser_screenshot", "hi_browser_wait", "hi_browser_close"];
export interface PrimaryToolVisibilityProjectionResult {
    targets: string[];
    defaultHidden: string[];
    explicitPreserved: string[];
    diagnostics: string[];
}
/**
 * OpenCode 1.18.x adapter optimization. The host's agent `tools:false` leaves
 * remove those schemas from the provider-visible catalog. We narrow only Hi's
 * own impossible/diagnostic leaves and never choose the host primary agent.
 * Explicit host/user choices win, including an explicit `true`.
 */
export declare function projectBuiltinPrimaryHiToolVisibility(config: Record<string, unknown>): PrimaryToolVisibilityProjectionResult;
