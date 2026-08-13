import { HI_CONFIG_SCHEMA } from './schema.js';
export const DEFAULT_HI_CONFIG = {
    schemaVersion: HI_CONFIG_SCHEMA,
    executionPolicy: 'adaptive',
    primaryMode: 'auto',
    compatibility: { mode: 'compatible', validatedOpenCodeVersions: [] },
    execution: { topology: 'adaptive', maxAgents: 4, parallelism: 2 },
    models: { mode: 'adaptive', default: 'auto', roles: {} },
    routing: { strategy: 'cost-quality', categoryModels: {}, categoryVariants: {}, roleModels: {}, roleVariants: {}, maxFallbacks: 3, allowedProviders: [], deniedModels: [] },
    parallel: { enabled: true, max: 3, providers: {}, models: {} },
    teamMode: { enabled: false, maxMembers: 4, maxMessages: 24, maxTurns: 12, maxWallMinutes: 45 },
    profile: {
        minimal: { specialistThreshold: 'high', reviewThreshold: 'low' },
        balanced: { specialistThreshold: 'medium', reviewThreshold: 'medium' },
        thorough: { specialistThreshold: 'low', reviewThreshold: 'high' },
    },
};
