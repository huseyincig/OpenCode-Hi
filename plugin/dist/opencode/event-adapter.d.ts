export type HiNativeEventKind = 'session-idle' | 'session-error' | 'session-deleted' | 'session-status' | 'session-diff' | 'session-compacted' | 'todo-updated' | 'permission-asked' | 'permission-replied' | 'file-edited' | 'file-watcher-updated' | 'lsp-diagnostics' | 'installation-updated' | 'unknown';
export interface NormalizedOpenCodeEvent {
    kind: HiNativeEventKind;
    rawType: string;
    sessionID?: string;
    properties: any;
    raw: any;
}
export declare function normalizeOpenCodeEvent(event: any): NormalizedOpenCodeEvent;
export declare function eventStatus(event: NormalizedOpenCodeEvent): string;
export declare function eventFilePaths(event: NormalizedOpenCodeEvent): string[];
export declare function permissionReply(event: NormalizedOpenCodeEvent): 'once' | 'always' | 'reject' | 'unknown';
export declare function permissionDecision(event: NormalizedOpenCodeEvent): 'allow' | 'deny' | 'unknown';
export declare function permissionPatterns(event: NormalizedOpenCodeEvent): string[];
export declare function permissionEventID(event: NormalizedOpenCodeEvent): string | undefined;
