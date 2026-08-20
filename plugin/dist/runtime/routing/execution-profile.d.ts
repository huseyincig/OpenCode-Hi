export type NativePermissionDecision = 'allow' | 'ask' | 'deny' | 'unknown';
export declare const HI_ACCOUNTED_PERMISSION_KEYS: readonly ["read", "glob", "grep", "list", "lsp", "bash", "edit", "skill", "todowrite", "webfetch", "websearch", "question", "task", "external_directory"];
export declare function unaccountedExecutionPermissionKeys(hostConfig: Record<string, unknown>, role: string): string[];
export interface NativePermissionSnapshot {
    mode?: string;
    decisions: Record<string, NativePermissionDecision>;
    source: 'effective-opencode-agent' | 'hi-default-invariants';
}
export interface EffectiveExecutionSurface {
    tools: string[];
    permissions: NativePermissionSnapshot;
}
export declare function effectiveExecutionSurface(hostConfig: Record<string, unknown>, role: string, skillToolEnabled: boolean): EffectiveExecutionSurface;
export declare const HI_CONTROL_TOOL_IDS: readonly ["hi_doctor", "hi_status", "hi_role_models", "hi_metrics", "hi_ledger", "hi_readiness", "hi_context_artifact_add", "hi_context_artifacts", "hi_temporary_mutation_register", "hi_temporary_mutation_revert", "hi_direct_progress", "hi_task_start", "hi_task_await", "hi_task_peek", "hi_task_list", "hi_task_cancel", "hi_process_spawn", "hi_process_read", "hi_process_write", "hi_process_wait", "hi_process_kill", "hi_process_cleanup", "hi_process_list"];
export declare const KNOWN_BUILTIN_TOOL_IDS: readonly ["bash", "edit", "write", "apply_patch", "read", "grep", "glob", "list", "lsp", "skill", "todowrite", "todoread", "webfetch", "websearch", "question", "task"];
export interface McpServerExposure {
    configured: string[];
    selected: string[];
    disabledPatterns: string[];
}
export declare function resolveMcpServerExposure(hostConfig: Record<string, unknown>, selected?: string[]): McpServerExposure;
export declare function taskPromptToolOverrides(allowed: string[], hostConfig: Record<string, unknown>, selectedMcpServers?: string[]): Record<string, boolean>;
export declare function promptToolOverrides(allowed: string[], hiToolNames?: string[]): Record<string, boolean>;
