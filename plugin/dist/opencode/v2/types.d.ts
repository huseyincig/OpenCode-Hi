export interface V2Registration {
    dispose(): Promise<void> | void;
}
export interface V2AgentDraft {
    list(): Array<Record<string, any>>;
    get(id: string): Record<string, any> | undefined;
    default(id: string | undefined): void;
    update(id: string, update: (agent: Record<string, any>) => void): void;
    remove(id: string): void;
}
export interface V2ToolDraft {
    add(tool: Record<string, any>): void;
}
export interface V2Context {
    app?: {
        name?: string;
        version?: string;
    };
    location: {
        directory: string;
        workspaceID?: string;
        project: {
            id: string;
            directory: string;
            canonical: string;
        };
    };
    options?: Record<string, unknown>;
    agent: {
        transform(cb: (draft: V2AgentDraft) => void): Promise<V2Registration>;
        reload(): Promise<void>;
        list?(): Promise<unknown>;
    };
    catalog: {
        provider?: {
            list?: (input?: unknown) => Promise<any>;
        };
        model?: {
            list?: (input?: unknown) => Promise<any>;
        };
    };
    command: {
        transform(cb: (draft: any) => void): Promise<V2Registration>;
        reload?(): Promise<void>;
        list?(): Promise<unknown>;
    };
    tool: {
        transform(cb: (draft: V2ToolDraft) => void): Promise<V2Registration>;
        reload?(): Promise<void>;
        hook(name: 'execute.before' | 'execute.after', cb: (event: any) => Promise<void> | void): Promise<V2Registration>;
    };
    session: {
        create(input?: any): Promise<any>;
        get(input: {
            sessionID: string;
        }): Promise<any>;
        switchAgent?(input: any): Promise<any>;
        switchModel?(input: any): Promise<any>;
        prompt(input: any): Promise<any>;
        synthetic?(input: any): Promise<any>;
        interrupt(input: {
            sessionID: string;
            continue?: boolean;
        }): Promise<any>;
        context(input: {
            sessionID: string;
        }): Promise<any[]>;
        hook(name: 'prompt' | 'context' | 'model.request' | 'http.request' | 'http.response' | 'retry', cb: (event: any) => Promise<void> | void): Promise<V2Registration>;
    };
    event: {
        subscribe(): AsyncIterable<Record<string, any>>;
    };
    permission?: {
        list?(input?: unknown): Promise<any>;
        get?(input: any): Promise<any>;
        reply?(input: any): Promise<any>;
        hook?(name: 'evaluate', cb: (event: any) => Promise<void> | void): Promise<V2Registration>;
    };
    skill?: {
        transform?(cb: (draft: any) => void): Promise<V2Registration>;
        reload?(): Promise<void>;
    };
}
export interface V2RuntimeFacts {
    status: Map<string, 'idle' | 'busy' | 'retry' | 'unknown'>;
    eventPumpAbort: AbortController;
}
