export declare function dataOf<T = any>(value: any): T;
export declare function createChildSession(client: any, parentID: string, title: string, agent?: string, model?: string, variant?: string): Promise<any>;
export declare function modelIdentity(model?: string): {
    providerID: string;
    modelID: string;
} | undefined;
export declare function sendPromptAsync(client: any, sessionID: string, text: string, agent?: string, model?: string, variant?: string, tools?: Record<string, boolean>): Promise<void>;
export declare function listMessages(client: any, sessionID: string, limit?: number): Promise<any[]>;
export declare function abortSession(client: any, sessionID: string): Promise<void>;
export declare function listProviders(client: any): Promise<any>;
export declare function eventSessionID(event: any): string | undefined;
export declare function lastAssistantText(messages: any[]): string;
export interface AssistantModelEvidence {
    model?: string;
    variant?: string;
    message_id?: string;
}
export declare function lastAssistantModel(messages: any[]): AssistantModelEvidence | undefined;
