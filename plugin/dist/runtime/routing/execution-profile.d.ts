export type NativePermissionDecision = 'allow' | 'ask' | 'deny' | 'unknown';
export interface NativePermissionSnapshot {
    mode?: string;
    decisions: Record<string, NativePermissionDecision>;
    source: 'effective-opencode-agent' | 'hhc-default-invariants';
}
export interface EffectiveExecutionSurface {
    tools: string[];
    permissions: NativePermissionSnapshot;
}
export declare function effectiveExecutionSurface(hostConfig: Record<string, unknown>, role: string, skillToolEnabled: boolean): EffectiveExecutionSurface;
export declare const HHC_CONTROL_TOOL_IDS: readonly ["hhc_doctor", "hhc_status", "hhc_metrics", "hhc_ledger", "hhc_readiness", "hhc_context_artifact_add", "hhc_context_artifacts", "hhc_temporary_mutation_register", "hhc_temporary_mutation_revert", "hhc_direct_progress", "hhc_task_start", "hhc_task_await", "hhc_task_peek", "hhc_task_list", "hhc_task_cancel", "hhc_team_create", "hhc_team_message", "hhc_team_inbox", "hhc_team_message_ack", "hhc_team_member_add", "hhc_team_member_remove", "hhc_team_status", "hhc_team_board", "hhc_team_shutdown"];
export declare const KNOWN_BUILTIN_TOOL_IDS: readonly ["bash", "edit", "write", "apply_patch", "read", "grep", "glob", "list", "lsp", "skill", "todowrite", "todoread", "webfetch", "websearch", "question", "task"];
export declare function promptToolOverrides(allowed: string[], hhcToolNames?: string[]): Record<string, boolean>;
