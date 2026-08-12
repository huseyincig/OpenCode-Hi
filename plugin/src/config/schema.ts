export const HHC_CONFIG_SCHEMA = 2 as const
export type AutonomyMode = 'basic' | 'standard' | 'powerful' | 'smart' | 'manual'
export type PrimaryModePolicy = 'auto'|'working-manager'|'manager'
export type RoutingStrategy = 'cost-quality' | 'quality' | 'cost'
export type CategoryName = 'quick'|'standard'|'deep'|'visual'|'critical'
export type CompatibilityMode = 'compatible'|'strict'

export interface ProfileSettings {
  specialistThreshold: 'low' | 'medium' | 'high'
  parallelThreshold: 'low' | 'medium' | 'high'
  reviewThreshold: 'low' | 'medium' | 'high'
  costSensitivity: 'low' | 'medium' | 'high'
  qualityFloor: 'standard' | 'high'
}

export interface HhcConfig {
  schemaVersion: typeof HHC_CONFIG_SCHEMA
  autonomy: AutonomyMode
  primaryMode: PrimaryModePolicy
  compatibility: { mode: CompatibilityMode; validatedOpenCodeVersions?: string[] }
  routing: {
    strategy: RoutingStrategy
    categoryModels: Partial<Record<CategoryName,string[]>>
    categoryVariants: Partial<Record<CategoryName,string[]>>
    roleModels: Record<string,string[]>
    roleVariants: Record<string,Record<string,string>>
    modelPolicy: 'recommended'|'smart-select'|'manual'
    smartSelectRoles: string[]
    maxFallbacks: number
    allowedProviders: string[]
    deniedModels: string[]
  }
  parallel: { enabled: boolean; max: number; providers: Record<string,number>; models: Record<string,number> }
  teamMode: { enabled: boolean; auto: boolean; maxMembers: number; maxMessages: number; maxTurns: number; maxWallMinutes: number }
  profile: { basic: ProfileSettings; standard: ProfileSettings; powerful: ProfileSettings }
}

export interface HhcRuntimeConfig { hhc: HhcConfig }
export interface ConfigResolutionReport { schema: typeof HHC_CONFIG_SCHEMA; canonical: boolean; notes: string[] }
export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
