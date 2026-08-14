import type { HiConfig } from './schema.js'
import { HI_CONFIG_DEFAULTS } from '../generated/config-policy.js'
export const DEFAULT_HI_CONFIG: HiConfig = structuredClone(HI_CONFIG_DEFAULTS) as unknown as HiConfig
