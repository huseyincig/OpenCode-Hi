import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { HhcConfig } from './schema.js'

// Reads .opencode/oho-routing.json (schema 1) from the project root and
// returns a Partial<HhcConfig> that callers can merge into the resolved
// HHC config. The runtime's HhcConfig.routing.roleModels stays
// user-controlled: this file is how the user expresses per-role
// model intent without editing native OpenCode config.

interface ProjectRoutingFile {
  schema?: number
  type?: string
  autonomy?: HhcConfig['autonomy']
  primaryMode?: HhcConfig['primaryMode']
  parallel?: Partial<HhcConfig['parallel']>
  teamMode?: Partial<HhcConfig['teamMode']>
  profile?: Partial<HhcConfig['profile']>
  routing?: {
    strategy?: 'cost-quality' | 'quality' | 'cost'
    roleModels?: Record<string, string[]>
    roleVariants?: Record<string, Record<string,string>>
    modelPolicy?: 'recommended'|'smart-select'|'manual'
    smartSelectRoles?: string[]
    categoryModels?: Record<string, string[]>
    categoryVariants?: Record<string, string[]>
    allowedProviders?: string[]
    deniedModels?: string[]
    maxFallbacks?: number
  }
}

export function loadProjectRoutingConfig(projectRoot: string): Partial<HhcConfig> | undefined {
  if (!projectRoot) return undefined
  const path = join(projectRoot, '.opencode', 'oho-routing.json')
  if (!existsSync(path)) return undefined
  let raw: ProjectRoutingFile
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
  if (raw?.schema !== 1 || raw?.type !== 'oho-routing') return undefined
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
  const out:Partial<HhcConfig> = {
    routing: {
      strategy: r.strategy ?? 'cost-quality',
      roleModels,
      roleVariants,
      modelPolicy: r.modelPolicy==='recommended'||r.modelPolicy==='manual'?'recommended'===r.modelPolicy?'recommended':'manual':'smart-select',
      smartSelectRoles: Array.isArray(r.smartSelectRoles)?r.smartSelectRoles.filter(x=>typeof x==='string'):[],
      categoryModels,
      categoryVariants,
      allowedProviders: Array.isArray(r.allowedProviders) ? r.allowedProviders.filter(x => typeof x === 'string') : [],
      deniedModels: Array.isArray(r.deniedModels) ? r.deniedModels.filter(x => typeof x === 'string') : [],
      ...(typeof r.maxFallbacks==='number'&&Number.isFinite(r.maxFallbacks)?{maxFallbacks:Math.max(0,Math.min(6,Math.floor(r.maxFallbacks)))}:{}),
    } as Partial<HhcConfig['routing']> as HhcConfig['routing'],
  }
  if(['basic','standard','powerful','smart','manual'].includes(String(raw.autonomy)))out.autonomy=raw.autonomy as HhcConfig['autonomy']
  if(['auto','working-manager','manager'].includes(String(raw.primaryMode)))out.primaryMode=raw.primaryMode as HhcConfig['primaryMode']
  if(raw.parallel&&typeof raw.parallel==='object')out.parallel=raw.parallel as HhcConfig['parallel']
  if(raw.teamMode&&typeof raw.teamMode==='object')out.teamMode=raw.teamMode as HhcConfig['teamMode']
  if(raw.profile&&typeof raw.profile==='object')out.profile=raw.profile as HhcConfig['profile']
  return out
}
