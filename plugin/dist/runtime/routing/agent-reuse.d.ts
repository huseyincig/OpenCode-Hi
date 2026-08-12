export type AgentReuseDecision = 'native-reuse-preferred' | 'hhc-custom-required';
export interface AgentReuseAudit {
    role: string;
    decision: AgentReuseDecision;
    reasons: string[];
}
export declare function auditNativeAgentReuse(role: string): AgentReuseAudit;
export declare function knownHhcCustomRoles(): string[];
