export type ShellDecision = 'ALLOW' | 'REWRITE' | 'USER_ACTION_REQUIRED' | 'DENY';
export interface ShellPolicyResult {
    decision: ShellDecision;
    command: string;
    reason: string;
}
export declare function evaluateShellCommand(command: string): ShellPolicyResult;
