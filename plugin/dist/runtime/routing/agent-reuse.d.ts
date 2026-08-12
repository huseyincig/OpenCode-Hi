export type AgentReuseDecision = 'native-reuse-preferred' | 'hi-custom-required';
export interface AgentReuseAudit {
    role: string;
    decision: AgentReuseDecision;
    reasons: string[];
}
export declare function auditNativeAgentReuse(role: string): AgentReuseAudit;
export declare function knownHiCustomRoles(): string[];
