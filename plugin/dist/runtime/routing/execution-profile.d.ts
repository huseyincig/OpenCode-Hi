export type NativePermissionDecision = 'allow' | 'ask' | 'deny' | 'unknown';
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
export declare const HI_CONTROL_TOOL_IDS: readonly ["hi_doctor", "hi_status", "hi_metrics", "hi_ledger", "hi_readiness", "hi_context_artifact_add", "hi_context_artifacts", "hi_temporary_mutation_register", "hi_temporary_mutation_revert", "hi_direct_progress", "hi_task_start", "hi_task_await", "hi_task_peek", "hi_task_list", "hi_task_cancel", "hi_team_create", "hi_team_member_add", "hi_team_member_remove", "hi_team_status", "hi_team_shutdown"];
export declare const KNOWN_BUILTIN_TOOL_IDS: readonly ["bash", "edit", "write", "apply_patch", "read", "grep", "glob", "list", "lsp", "skill", "todowrite", "todoread", "webfetch", "websearch", "question", "task"];
export declare function promptToolOverrides(allowed: string[], hiToolNames?: string[]): Record<string, boolean>;
