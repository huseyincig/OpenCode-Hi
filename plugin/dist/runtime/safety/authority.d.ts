import type { MissionState } from '../mission/types.js';
import type { ExactAuthorityActionContract } from '../../contracts/authority.js';
export declare const AUTHORITY_APPROVAL_TTL_MS: number;
export declare function privilegedAction(command: string): boolean;
export declare function actionContract(command: string, cwd?: string): ExactAuthorityActionContract;
export declare function isAuthorized(m: MissionState, command: string, cwd?: string): boolean;
export declare function claimAuthorizedAction(m: MissionState, command: string, cwd?: string): 'new' | 'duplicate' | 'conflict';
export declare function beginAuthorizedAction(m: MissionState, command: string, cwd?: string): void;
export type AuthorityExecutionOutcome = 'success' | 'failure' | 'unknown';
export declare function completeAuthorizedAction(m: MissionState, command: string, cwd: string | undefined, outcome: AuthorityExecutionOutcome, detail?: string): boolean;
export declare function requireAuthority(m: MissionState, command: string, cwd?: string): never;
export interface AuthorityProtocolResponse {
    decision_id: string;
    authority_ref: string;
    response: 'approve' | 'success' | 'failure';
}
export declare function approvePendingAuthority(m: MissionState, input: unknown): boolean;
export declare function resolveUncertainAuthority(m: MissionState, input: unknown): boolean;
