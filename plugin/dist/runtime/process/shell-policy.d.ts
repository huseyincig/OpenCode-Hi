export type ShellDecision = 'ALLOW' | 'REWRITE' | 'USER_ACTION_REQUIRED' | 'DENY';
export type ShellHumanDecisionType = 'credential_action' | 'operational_action';
export interface ShellPolicyResult {
    decision: ShellDecision;
    command: string;
    reason: string;
    human_decision_type?: ShellHumanDecisionType;
    reason_code?: string;
}
export declare function evaluateShellCommand(command: string): ShellPolicyResult;
