import type { OpenCodeClient } from './types.js';
import { type HostUsageObservation } from '../contracts/execution-usage.js';
import type { HostPromptFormat } from '../runtime/host/port.js';
export declare function dataOf<T = any>(value: any): T;
export declare function createChildSession(client: OpenCodeClient, parentID: string, title: string, agent?: string, model?: string, variant?: string, workspaceID?: string, endpoint?: OpenCodeLifecycleEndpoint): Promise<any>;
export declare function modelIdentity(model?: string): {
    providerID: string;
    modelID: string;
} | undefined;
export declare function sendPromptAsync(client: OpenCodeClient, sessionID: string, text: string, agent?: string, model?: string, variant?: string, tools?: Record<string, boolean>, ackTimeoutMs?: number, messageID?: string, format?: HostPromptFormat): Promise<void>;
export declare function listMessages(client: OpenCodeClient, sessionID: string, limit?: number): Promise<any[]>;
export declare function sendSyntheticContinuation(client: OpenCodeClient, sessionID: string, text: string, metadata: Record<string, unknown>, ackTimeoutMs?: number): Promise<boolean>;
export interface OpenCodeLifecycleEndpoint {
    serverUrl?: string;
    directory?: string;
}
export type AbortSessionResult = 'server' | 'server-reconciled' | 'client' | 'client-reconciled' | 'unavailable';
export type SessionRuntimeStatus = 'idle' | 'busy' | 'retry' | 'unknown';
export declare function sessionRuntimeStatusFromStatus(value: unknown, sessionID: string): SessionRuntimeStatus;
export declare function readSessionRuntimeStatus(client: OpenCodeClient, sessionID: string, endpoint?: OpenCodeLifecycleEndpoint): Promise<SessionRuntimeStatus>;
export declare function abortSession(client: OpenCodeClient, sessionID: string, endpoint?: OpenCodeLifecycleEndpoint): Promise<AbortSessionResult>;
export declare function listProviders(client: OpenCodeClient): Promise<unknown>;
export declare function listAvailableModels(endpoint?: OpenCodeLifecycleEndpoint): Promise<unknown[] | undefined>;
export declare function eventSessionID(event: any): string | undefined;
export declare function lastAssistantText(messages: any[]): string;
export declare function lastAssistantStructured(messages: any[]): unknown;
export interface IncompleteAssistantTurnEvidence {
    message_id?: string;
    parent_id?: string;
    created_at: number;
    empty: boolean;
}
export declare function lastIncompleteAssistantTurn(messages: any[]): IncompleteAssistantTurnEvidence | undefined;
export interface AssistantActivityEvidence {
    message_id?: string;
    observed_at: number;
    output_tokens: number;
    reasoning_tokens: number;
    tool_calls: number;
    text_chars: number;
}
export declare function lastMeaningfulAssistantActivity(messages: any[]): AssistantActivityEvidence | undefined;
export interface AssistantErrorEvidence {
    name?: string;
    message: string;
    isRetryable?: boolean;
    statusCode?: number;
}
export declare function assistantErrorEvidence(value: any): AssistantErrorEvidence | undefined;
export declare function lastAssistantError(messages: any[]): AssistantErrorEvidence | undefined;
export interface AssistantModelEvidence {
    model?: string;
    variant?: string;
    message_id?: string;
    parent_id?: string;
    created_at?: number;
}
export declare function lastAssistantModel(messages: any[]): AssistantModelEvidence | undefined;
export declare function lastAssistantUsage(messages: any[]): HostUsageObservation | undefined;
