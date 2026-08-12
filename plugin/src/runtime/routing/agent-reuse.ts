export type AgentReuseDecision='native-reuse-preferred'|'hi-custom-required'
export interface AgentReuseAudit { role:string; decision:AgentReuseDecision; reasons:string[] }

const Hi_CUSTOM_ROLE_REQUIREMENTS:Record<string,string[]>= {
  'manager':['Hi control-plane ownership','mission/obligation routing','no normal edit/bash surface'],
  'working-manager':['Hi direct-progress/evidence contract','bounded write permission profile'],
  'coder':['structured WorkerResult contract','Hi evidence/freshness contract','selected-skill boundary'],
  'repository-explorer':['bounded artifact-oriented handoff','NEEDS_CONTEXT same-session contract','read-only Hi evidence contract'],
  'architect':['contract-critical ambiguity handling','read-only design obligation contract'],
  'qa-reviewer':['scoped rereview contract','structured review evidence'],
  'security-reviewer':['high-assurance obligation ownership','read-only security evidence contract'],
  'visual-qa':['visual review obligation contract','bounded review evidence'],
}

export function auditNativeAgentReuse(role:string):AgentReuseAudit{
  const reasons=Hi_CUSTOM_ROLE_REQUIREMENTS[role]
  if(reasons?.length)return{role,decision:'hi-custom-required',reasons}
  return{role,decision:'native-reuse-preferred',reasons:['No Hi-specific role contract is registered; prefer an equivalent native OpenCode agent/subagent before defining a new persona.']}
}

export function knownHiCustomRoles():string[]{return Object.keys(Hi_CUSTOM_ROLE_REQUIREMENTS).sort()}
