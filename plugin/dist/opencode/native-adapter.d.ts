import type { OpenCodeClient } from './types.js';
export type NativeCapabilityName = 'session-create' | 'prompt-async' | 'prompt-sync' | 'abort' | 'status' | 'children' | 'todo' | 'diff' | 'fork' | 'summarize' | 'revert' | 'unrevert' | 'provider-inventory' | 'structured-log';
export type NativeOperationName = NativeCapabilityName | 'version';
export type NativeOperationEffect = 'read-only' | 'mutating';
export declare function nativeOperationEffect(name: NativeOperationName): NativeOperationEffect;
export interface NativeSessionSnapshot {
    status?: unknown;
    children?: unknown[];
    todo?: unknown[];
    diff?: unknown;
}
export declare class NativeOpenCodeAdapter {
    readonly client: OpenCodeClient;
    constructor(client: OpenCodeClient);
    has(name: NativeCapabilityName): boolean;
    status(sessionID: string): Promise<any>;
    children(sessionID: string): Promise<any[]>;
    todo(sessionID: string): Promise<any[]>;
    diff(sessionID: string): Promise<any>;
    fork(sessionID: string, title?: string): Promise<any>;
    summarize(sessionID: string): Promise<any>;
    revert(sessionID: string, messageID?: string): Promise<any>;
    unrevert(sessionID: string): Promise<any>;
    prompt(sessionID: string, text: string, agent?: string, model?: string, variant?: string): Promise<void>;
    version(): Promise<string | undefined>;
    snapshot(sessionID: string): Promise<NativeSessionSnapshot>;
}
export declare function effectiveConfigView(hostConfig: Record<string, unknown> | undefined): Record<string, unknown>;
export declare function configuredSubagentDepth(hostConfig: Record<string, unknown> | undefined): number | undefined;
export { providerPolicyView } from '../runtime/host/provider-policy.js';
export declare function configuredRemoteInstructions(hostConfig: Record<string, unknown> | undefined): string[];
export declare function configuredPluginSpecs(hostConfig: Record<string, unknown> | undefined): string[];
export declare function configuredShareMode(hostConfig: Record<string, unknown> | undefined): unknown;
