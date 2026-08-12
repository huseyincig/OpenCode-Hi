const HHC_CUSTOM_ROLE_REQUIREMENTS = {
    'manager': ['HHC control-plane ownership', 'mission/obligation routing', 'no normal edit/bash surface'],
    'working-manager': ['HHC direct-progress/evidence contract', 'bounded write permission profile'],
    'coder': ['structured WorkerResult contract', 'HHC evidence/freshness contract', 'selected-skill boundary'],
    'repository-explorer': ['bounded artifact-oriented handoff', 'NEEDS_CONTEXT same-session contract', 'read-only HHC evidence contract'],
    'architect': ['contract-critical ambiguity handling', 'read-only design obligation contract'],
    'qa-reviewer': ['scoped rereview contract', 'structured review evidence'],
    'security-reviewer': ['high-assurance obligation ownership', 'read-only security evidence contract'],
    'visual-qa': ['visual review obligation contract', 'bounded review evidence'],
};
export function auditNativeAgentReuse(role) {
    const reasons = HHC_CUSTOM_ROLE_REQUIREMENTS[role];
    if (reasons?.length)
        return { role, decision: 'hhc-custom-required', reasons };
    return { role, decision: 'native-reuse-preferred', reasons: ['No HHC-specific role contract is registered; prefer an equivalent native OpenCode agent/subagent before defining a new persona.'] };
}
export function knownHhcCustomRoles() { return Object.keys(HHC_CUSTOM_ROLE_REQUIREMENTS).sort(); }
