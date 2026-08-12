import { HHC_CONFIG_SCHEMA } from './schema.js';
export const DEFAULT_HHC_CONFIG = {
    schemaVersion: HHC_CONFIG_SCHEMA,
    autonomy: 'smart',
    primaryMode: 'auto',
    compatibility: { mode: 'compatible', validatedOpenCodeVersions: [] },
    routing: { strategy: 'cost-quality', categoryModels: {}, categoryVariants: {}, roleModels: {}, roleVariants: {}, modelPolicy: 'smart-select', smartSelectRoles: [], maxFallbacks: 3, allowedProviders: [], deniedModels: [] },
    parallel: { enabled: true, max: 3, providers: {}, models: {} },
    teamMode: { enabled: false, auto: false, maxMembers: 4, maxMessages: 24, maxTurns: 12, maxWallMinutes: 45 },
    profile: {
        basic: { specialistThreshold: 'high', parallelThreshold: 'high', reviewThreshold: 'low', costSensitivity: 'high', qualityFloor: 'standard' },
        standard: { specialistThreshold: 'medium', parallelThreshold: 'medium', reviewThreshold: 'medium', costSensitivity: 'medium', qualityFloor: 'standard' },
        powerful: { specialistThreshold: 'low', parallelThreshold: 'low', reviewThreshold: 'high', costSensitivity: 'low', qualityFloor: 'high' },
    },
};
