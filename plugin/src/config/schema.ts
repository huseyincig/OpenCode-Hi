export const HI_CONFIG_SCHEMA = 2 as const
export type ExecutionPolicyMode = 'minimal' | 'balanced' | 'thorough' | 'adaptive' | 'manual'
export type PrimaryModePolicy = 'auto'|'working-manager'|'manager'
export type RoutingStrategy = 'cost-quality' | 'quality' | 'cost'
export type CategoryName = 'quick'|'standard'|'deep'|'visual'|'critical'
export type CompatibilityMode = 'compatible'|'strict'
export type TopologyMode = 'adaptive'|'single-agent'|'multi-agent'
export type ModelSelectionMode = 'adaptive'|'fixed'|'role-mapped'

export interface ProfileSettings {
  specialistThreshold: 'low' | 'medium' | 'high'
  parallelThreshold: 'low' | 'medium' | 'high'
  reviewThreshold: 'low' | 'medium' | 'high'
  costSensitivity: 'low' | 'medium' | 'high'
  qualityFloor: 'standard' | 'high'
}

export interface HiConfig {
  schemaVersion: typeof HI_CONFIG_SCHEMA
  executionPolicy: ExecutionPolicyMode
  primaryMode: PrimaryModePolicy
  compatibility: { mode: CompatibilityMode; validatedOpenCodeVersions?: string[] }
  routing: {
    strategy: RoutingStrategy
    categoryModels: Partial<Record<CategoryName,string[]>>
    categoryVariants: Partial<Record<CategoryName,string[]>>
    roleModels: Record<string,string[]>
    roleVariants: Record<string,Record<string,string>>
    modelPolicy: 'recommended'|'adaptive'|'manual'
    adaptiveRoles: string[]
    maxFallbacks: number
    allowedProviders: string[]
    deniedModels: string[]
  }
  execution: { topology: TopologyMode; maxAgents: number; parallelism: number; allowMultiRoleAgent: boolean }
  models: { mode: ModelSelectionMode; default: string; roles: Record<string,string> }
  parallel: { enabled: boolean; max: number; providers: Record<string,number>; models: Record<string,number> }
  teamMode: { enabled: boolean; auto: boolean; maxMembers: number; maxMessages: number; maxTurns: number; maxWallMinutes: number }
  profile: { minimal: ProfileSettings; balanced: ProfileSettings; thorough: ProfileSettings }
}

export interface HiRuntimeConfig { hi: HiConfig }
export interface ConfigResolutionReport { schema: typeof HI_CONFIG_SCHEMA; canonical: boolean; notes: string[] }
export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
