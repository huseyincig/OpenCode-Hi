import type { HumanDecisionContract, HumanDecisionResponseKind } from '../../contracts/human-decision.js';
export type HumanDecisionTransportState = 'OPEN' | 'RESPONDED' | 'CANCELLED';
export interface HumanDecisionTransportHandle {
    decision_id: string;
    transport: 'chat';
    state: HumanDecisionTransportState;
    opened_at: number;
}
export interface HumanDecisionTransportResponse {
    decision_id: string;
    kind: HumanDecisionResponseKind;
    value: string | string[];
    received_at: number;
}
export type HumanDecisionAwaitResult = {
    status: 'RESPONDED';
    response: HumanDecisionTransportResponse;
} | {
    status: 'CANCELLED';
    decision_id: string;
} | {
    status: 'TIMEOUT';
    decision_id: string;
};
export interface HumanDecisionTransport {
    open(decision: HumanDecisionContract): HumanDecisionTransportHandle;
    await(decisionId: string): Promise<HumanDecisionAwaitResult>;
    cancel(decisionId: string): void;
    dispose(): void;
}
export declare class ChatHumanDecisionTransport implements HumanDecisionTransport {
    #private;
    private readonly timeoutMs;
    static readonly TERMINAL_HISTORY_LIMIT = 64;
    constructor(timeoutMs?: number);
    open(decision: HumanDecisionContract): HumanDecisionTransportHandle;
    await(decisionId: string): Promise<HumanDecisionAwaitResult>;
    cancel(decisionId: string): void;
    respond(decisionId: string, value: string | string[]): HumanDecisionTransportResponse | undefined;
    handle(decisionId: string): HumanDecisionTransportHandle | undefined;
    dispose(): void;
}
export declare function syncHumanDecisionTransport(decision: HumanDecisionContract | undefined, transport: HumanDecisionTransport): HumanDecisionTransportHandle | undefined;
