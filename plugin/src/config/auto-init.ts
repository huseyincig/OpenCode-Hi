// Runtime routing bootstrap for projects that do not yet have
// `.opencode/hi/policy/routing.json`.
//
// M16 deliberately does not persist catalog guesses or vendor/model IDs.
// Initial child-role recommendations are supplied by the runtime only after
// OpenCode exposes the effective inventory and Hi ranks eligible models.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
