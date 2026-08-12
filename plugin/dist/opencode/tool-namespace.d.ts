export declare const RESERVED_NATIVE_TOOL_NAMES: Set<string>;
export interface ToolNamespaceAudit {
    ok: boolean;
    collisions: string[];
    nonNamespaced: string[];
}
export declare function auditHhcToolNamespace(names: string[]): ToolNamespaceAudit;
export declare function assertHhcToolNamespace(names: string[]): void;
