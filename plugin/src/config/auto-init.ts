// Runtime routing bootstrap for projects that do not yet have
// `.opencode/hi/policy/routing.json`.
//
// M16 deliberately does not persist catalog guesses or vendor/model IDs.
// Initial child-role recommendations are supplied by the runtime only after
// OpenCode exposes the effective inventory and Hi ranks eligible models.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { MODEL_ROUTED_CHILD_ROLES, type ModelRoutedChildRole } from './schema.js'
import { dirname, join } from 'node:path'

export const DEFAULT_STRATEGY: 'cost-quality' = 'cost-quality'
export type InitialRoleRecommendations = Partial<Record<ModelRoutedChildRole,string[]>>

function normalizeRecommendations(input:InitialRoleRecommendations):Record<string,string[]>{
  const out:Record<string,string[]>={}
  for(const role of MODEL_ROUTED_CHILD_ROLES){const ids=[...new Set(input[role]??[])].filter(Boolean);if(ids.length)out[role]=ids}
  return out
}

export function defaultProjectRoutingConfig(initialRecommendations:InitialRoleRecommendations = {}): {
  schema: 1
  type: 'hi-routing'
  routing: { strategy: 'cost-quality'; modelPolicy:'recommended'; roleModels: Record<string, string[]>; roleVariants:Record<string,Record<string,string>>; adaptiveRoles:string[] }
  applied_at: number
  applied_by: string
} {
  const roleModels=normalizeRecommendations(initialRecommendations)
  const adaptiveRoles=(MODEL_ROUTED_CHILD_ROLES as readonly string[]).filter(role=>!roleModels[role]?.length)
  return {
    schema: 1,
    type: 'hi-routing',
    routing: {
      strategy: DEFAULT_STRATEGY,
      modelPolicy: 'recommended',
      roleModels,
      roleVariants: {},
      adaptiveRoles,
    },
    applied_at: Date.now(),
    applied_by: 'opencode-hi',
  }
}

export function ensureProjectRoutingConfig(projectRoot: string, initialRecommendations?: InitialRoleRecommendations): { created: boolean; path: string; configuredRoles?: number; reason?: string } {
  const path = join(projectRoot, '.opencode', 'hi', 'policy', 'routing.json')
  if (existsSync(path)) {
    try {
      const current=JSON.parse(readFileSync(path,'utf8'))
      if(current?.schema===1&&current?.type==='hi-routing'&&current.routing&&typeof current.routing==='object')return{created:false,path}
      if(current?.schema===1&&current?.type==='hi-routing'&&initialRecommendations!==undefined){
        const next=defaultProjectRoutingConfig(initialRecommendations),configuredRoles=Object.keys(next.routing.roleModels).length
        current.routing=next.routing;current.applied_at=next.applied_at;current.applied_by=next.applied_by
        writeFileSync(path,JSON.stringify(current,null,2)+'\n','utf8')
        return{created:true,path,configuredRoles,reason:'inventory-ranked-initial-policy-merged-with-project-settings'}
      }
    } catch {}
    return { created: false, path }
  }
  if(initialRecommendations===undefined)return{created:false,path,configuredRoles:0,reason:'runtime-inventory-required-for-initial-recommendation'}
  const next=defaultProjectRoutingConfig(initialRecommendations)
  const configuredRoles=Object.keys(next.routing.roleModels).length
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(next, null, 2) + '\n', 'utf8')
  return { created: true, path, configuredRoles, reason:'inventory-ranked-initial-policy' }
}


export function setProjectRoleModels(projectRoot:string, role:ModelRoutedChildRole, models:string[]):{path:string;roleModels:Record<string,string[]>}{
  const path=join(projectRoot,'.opencode','hi','policy','routing.json')
  let current:any={schema:1,type:'hi-routing',routing:{}}
  if(existsSync(path)){
    try{const parsed=JSON.parse(readFileSync(path,'utf8'));if(parsed?.schema===1&&parsed?.type==='hi-routing'&&parsed.routing&&typeof parsed.routing==='object'&&!Array.isArray(parsed.routing))current=parsed;else throw new Error('unsupported routing shape')}catch(error){throw new Error(`Cannot update Hi role routing: ${String(error)}`)}
  }
  const routing={...(current.routing??{})},existing=routing.roleModels&&typeof routing.roleModels==='object'&&!Array.isArray(routing.roleModels)?routing.roleModels:{},roleModels={...existing}
  const normalized=[...new Set(models.map(String).map(x=>x.trim()).filter(Boolean))]
  if(normalized.length)roleModels[role]=normalized;else delete roleModels[role]
  const adaptive=new Set(Array.isArray(routing.adaptiveRoles)?routing.adaptiveRoles.map(String):[])
  if(normalized.length)adaptive.delete(role);else adaptive.add(role)
  const next={...current,schema:1,type:'hi-routing',routing:{...routing,modelPolicy:'manual',roleModels,adaptiveRoles:[...adaptive].map(String).filter(x=>(MODEL_ROUTED_CHILD_ROLES as readonly string[]).includes(x))},applied_at:Date.now(),applied_by:'opencode-hi'}
  mkdirSync(dirname(path),{recursive:true})
  const tmp=`${path}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`
  writeFileSync(tmp,JSON.stringify(next,null,2)+'\n','utf8');renameSync(tmp,path)
  return{path,roleModels:normalizeRecommendations(roleModels as InitialRoleRecommendations)}
}
