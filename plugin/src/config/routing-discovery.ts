import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { HiConfig } from './schema.js'

// Reads .opencode/hi/policy/routing.json (schema 1) from the project root and
// returns a Partial<HiConfig> that callers can merge into the resolved
// Hi config. The runtime's HiConfig.routing.roleModels stays
// user-controlled: this file is how the user expresses per-role
// model intent without editing native OpenCode config.

interface ProjectRoutingFile {
  schema?: number
  type?: string
  executionPolicy?: HiConfig['executionPolicy']
  primaryMode?: HiConfig['primaryMode']
  execution?: Partial<HiConfig['execution']>
  models?: Partial<HiConfig['models']>
  parallel?: Partial<HiConfig['parallel']>
  teamMode?: Partial<HiConfig['teamMode']>
  profile?: Partial<HiConfig['profile']>
  routing?: {
    strategy?: 'cost-quality' | 'quality' | 'cost'
    roleModels?: Record<string, string[]>
    roleVariants?: Record<string, Record<string,string>>
    modelPolicy?: 'recommended'|'adaptive'|'manual'
    adaptiveRoles?: string[]
    categoryModels?: Record<string, string[]>
    categoryVariants?: Record<string, string[]>
    allowedProviders?: string[]
    deniedModels?: string[]
    maxFallbacks?: number
  }
}

export function loadProjectRoutingConfig(projectRoot: string): Partial<HiConfig> | undefined {
  if (!projectRoot) return undefined
  const path = join(projectRoot, '.opencode', 'hi', 'policy', 'routing.json')
  if (!existsSync(path)) return undefined
  let raw: ProjectRoutingFile
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
  if (raw?.schema !== 1 || raw?.type !== 'hi-routing') return undefined
  const r = raw?.routing && typeof raw.routing === 'object' ? raw.routing : {}
  const roleModels: Record<string, string[]> = {}
  if (r.roleModels && typeof r.roleModels === 'object') {
    for (const [k, v] of Object.entries(r.roleModels)) {
      if (Array.isArray(v)) roleModels[k] = v.filter(x => typeof x === 'string')
    }
  }
  const roleVariants: Record<string,Record<string,string>> = {}
  if (r.roleVariants && typeof r.roleVariants === 'object') {
    for (const [role, value] of Object.entries(r.roleVariants)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue
      const variants:Record<string,string> = {}
      for (const [model, variant] of Object.entries(value)) if (typeof variant === 'string' && variant.trim()) variants[model]=variant.trim()
      if (Object.keys(variants).length) roleVariants[role]=variants
    }
  }
  const categoryModels: Record<string, string[]> = {}
  if (r.categoryModels && typeof r.categoryModels === 'object') {
    for (const [k, v] of Object.entries(r.categoryModels)) {
      if (Array.isArray(v)) categoryModels[k] = v.filter(x => typeof x === 'string')
    }
  }
  const categoryVariants: Record<string, string[]> = {}
  if (r.categoryVariants && typeof r.categoryVariants === 'object') {
    for (const [k, v] of Object.entries(r.categoryVariants)) {
      if (Array.isArray(v)) categoryVariants[k] = v.filter(x => typeof x === 'string')
    }
  }
  const out:Partial<HiConfig> = {
    routing: {
      strategy: r.strategy ?? 'cost-quality',
      roleModels,
      roleVariants,
      categoryModels,
      categoryVariants,
      allowedProviders: Array.isArray(r.allowedProviders) ? r.allowedProviders.filter(x => typeof x === 'string') : [],
      deniedModels: Array.isArray(r.deniedModels) ? r.deniedModels.filter(x => typeof x === 'string') : [],
      ...(typeof r.maxFallbacks==='number'&&Number.isFinite(r.maxFallbacks)?{maxFallbacks:Math.max(0,Math.min(6,Math.floor(r.maxFallbacks)))}:{}),
    } as Partial<HiConfig['routing']> as HiConfig['routing'],
  }
  const executionPolicyMap:Record<string,HiConfig['executionPolicy']>={minimal:'minimal',balanced:'balanced',thorough:'thorough',adaptive:'adaptive',manual:'manual'}
  const executionPolicy=executionPolicyMap[String(raw.executionPolicy)]
  if(executionPolicy)out.executionPolicy=executionPolicy
  if(['auto','working-manager','manager'].includes(String(raw.primaryMode)))out.primaryMode=raw.primaryMode as HiConfig['primaryMode']
  if(raw.execution&&typeof raw.execution==='object')out.execution=raw.execution as HiConfig['execution']
  if(raw.models&&typeof raw.models==='object')out.models=raw.models as HiConfig['models']
  if(raw.parallel&&typeof raw.parallel==='object')out.parallel=raw.parallel as HiConfig['parallel']
  if(raw.teamMode&&typeof raw.teamMode==='object')out.teamMode=raw.teamMode as HiConfig['teamMode']
  if(raw.profile&&typeof raw.profile==='object')out.profile=raw.profile as HiConfig['profile']
  return out
}
