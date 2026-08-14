export declare const EXTERNAL_ACTION_TYPES: readonly ["git-push", "release-create", "package-publish", "deploy"];
export type ExternalActionType = typeof EXTERNAL_ACTION_TYPES[number];
export interface ExternalActionContract {
    action_type: ExternalActionType;
    target: string;
    requested_explicitly: boolean;
    required_authority_ref: string;
    executor: string;
    result_evidence_ref?: string;
}
export declare function isExternalActionType(v: unknown): v is ExternalActionType;
export declare function isExternalActionContract(v: unknown): v is ExternalActionContract;
export declare function externalActionTypeFromTechnicalKind(kind: string): ExternalActionType | undefined;
