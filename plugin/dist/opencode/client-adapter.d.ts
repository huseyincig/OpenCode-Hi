import type { OpenCodeClient } from './types.js';
export declare function dataOf<T = any>(value: any): T;
export declare function createChildSession(client: OpenCodeClient, parentID: string, title: string, agent?: string, model?: string, variant?: string, workspaceID?: string): Promise<any>;
export declare function modelIdentity(model?: string): {
    providerID: string;
    modelID: string;
} | undefined;
export declare function sendPromptAsync(client: OpenCodeClient, sessionID: string, text: string, agent?: string, model?: string, variant?: string, tools?: Record<string, boolean>): Promise<void>;
export declare function listMessages(client: OpenCodeClient, sessionID: string, limit?: number): Promise<any[]>;
export declare function sendSyntheticContinuation(client: OpenCodeClient, sessionID: string, text: string, metadata: Record<string, unknown>): Promise<boolean>;
export interface OpenCodeLifecycleEndpoint {
    serverUrl?: string;
    directory?: string;
}
export declare function abortSession(client: OpenCodeClient, sessionID: string, endpoint?: OpenCodeLifecycleEndpoint): Promise<'server' | 'client' | 'unavailable'>;
export declare function listProviders(client: OpenCodeClient): Promise<unknown>;
export declare function eventSessionID(event: any): string | undefined;
export declare function lastAssistantText(messages: any[]): string;
export interface AssistantModelEvidence {
    model?: string;
    variant?: string;
    message_id?: string;
}
export declare function lastAssistantModel(messages: any[]): AssistantModelEvidence | undefined;
