import type { MissionState } from '../mission/types.js';
export declare function privilegedAction(command: string): boolean;
export declare function actionContract(command: string, cwd?: string): {
    action: string;
    hash: string;
};
export declare function isAuthorized(m: MissionState, command: string, cwd?: string): boolean;
export declare function claimAuthorizedAction(m: MissionState, command: string, cwd?: string): 'new' | 'duplicate' | 'conflict';
export declare function consumeAuthority(m: MissionState, command: string, cwd?: string): void;
export declare function beginAuthorizedAction(m: MissionState, command: string, cwd?: string): void;
export type AuthorityExecutionOutcome = 'success' | 'failure' | 'unknown';
export declare function completeAuthorizedAction(m: MissionState, command: string, cwd: string | undefined, outcome: AuthorityExecutionOutcome, detail?: string): boolean;
export declare function requireAuthority(m: MissionState, command: string, cwd?: string): never;
export declare function approvePendingAuthority(m: MissionState, text: string): boolean;
export declare function resolveUncertainAuthority(m: MissionState, text: string): boolean;
