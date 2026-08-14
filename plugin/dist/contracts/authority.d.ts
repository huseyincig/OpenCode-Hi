import type { ExternalActionType } from './external-action.js';
export interface ExactAuthorityActionContract {
    authority_id: string;
    action_type: ExternalActionType;
    target: {
        cwd: string;
        command: string;
    };
    action: string;
    hash: string;
    requested_by: 'mission-parent';
    required_reason: 'privileged-external-effect';
    one_shot: true;
}
export interface PendingAuthorityState {
    hash: string;
    action: string;
    created_at: number;
}
export interface ApprovedAuthorityState {
    hash: string;
    approved_at: number;
}
export interface ExecutingAuthorityState {
    hash: string;
    action: string;
    started_at: number;
}
export interface AuthorityStateContract {
    pending?: PendingAuthorityState;
    approved?: ApprovedAuthorityState;
    executing?: ExecutingAuthorityState;
    completed_hashes?: string[];
}
export declare function isAuthorityStateContract(v: unknown): v is AuthorityStateContract;
