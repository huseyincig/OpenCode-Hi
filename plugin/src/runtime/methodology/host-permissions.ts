import { discoverProjectMethodologyPolicies } from './project-policy.js'

type Permission='allow'|'ask'|'deny'
function record(value:unknown):Record<string,unknown>|undefined{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined}

export function applyAdmittedProjectMethodologyPermissions(hostConfig:Record<string,unknown>,projectRoot:string):Array<{name:string;role:string;decision:Permission}>{
  const agents=record(hostConfig.agent);if(!agents)return[]
  const applied:Array<{name:string;role:string;decision:Permission}>=[]
  for(const policy of discoverProjectMethodologyPolicies(projectRoot)){
    for(const role of policy.compatible_roles){
      const agent=record(agents[role]);if(!agent)continue
      const permission=record(agent.permission)??{};if(!agent.permission)agent.permission=permission
      const skill=record(permission.skill)??{};if(!permission.skill)permission.skill=skill
      const exact=skill[policy.name]
      if(exact==='deny'||exact==='ask'||exact==='allow'){applied.push({name:policy.name,role,decision:exact});continue}
      // Repository-local methodology provenance proves integrity, not user trust. A project
      // cannot silently grant itself native skill execution permission merely by committing
      // SKILL/policy/provenance files. Exact host/user allow may opt in; deny always wins.
      skill[policy.name]='ask'
      applied.push({name:policy.name,role,decision:'ask'})
    }
  }
  return applied
}
