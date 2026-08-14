export declare const HUMAN_DECISION_TYPES: readonly ["preference", "ambiguity", "value_judgment", "credential_action", "authority_request", "operational_action"];
export declare const HUMAN_DECISION_RESPONSE_KINDS: readonly ["free-text", "choice", "external-action", "authority-protocol"];
export declare const HUMAN_DECISION_STATUSES: readonly ["OPEN", "RESOLVED"];
export type HumanDecisionType = typeof HUMAN_DECISION_TYPES[number];
export type HumanDecisionResponseKind = typeof HUMAN_DECISION_RESPONSE_KINDS[number];
export type HumanDecisionStatus = typeof HUMAN_DECISION_STATUSES[number];
export interface HumanDecisionScope {
    mission_id: string;
    task_id?: string;
    worker_id?: string;
}
export interface HumanDecisionResponseSchema {
    kind: HumanDecisionResponseKind;
    protocol?: 'approve-exact-action' | 'reconcile-action-outcome' | 'new-exact-action-contract';
    choices?: string[];
}
export interface HumanDecisionContract {
    decision_id: string;
    semantic_type: HumanDecisionType;
    reason_code: string;
    summary: string;
    blocking_scope: HumanDecisionScope;
    response_schema: HumanDecisionResponseSchema;
    authority_ref?: string;
    status: HumanDecisionStatus;
    created_at: number;
    resolved_at?: number;
    resolution?: string;
}
export declare function humanDecisionId(input: {
    semantic_type: HumanDecisionType;
    reason_code: string;
    blocking_scope: HumanDecisionScope;
    authority_ref?: string;
}): string;
export declare function isHumanDecisionContract(v: unknown): v is HumanDecisionContract;
