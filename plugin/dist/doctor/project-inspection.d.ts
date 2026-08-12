export interface ProjectInspection {
    configPath?: string;
    pluginRegistered?: boolean;
    configuredHiPluginSpecs: string[];
    localHiPlugin: boolean;
    hiLocalPluginPaths: string[];
    permissionConfigured: boolean;
    skillPermissionConfigured: boolean;
    ownershipState: 'missing' | 'healthy' | 'invalid';
    ownershipSchema?: number;
    ownershipSchemaValid?: boolean;
    runtimeState: 'missing' | 'healthy' | 'invalid';
    runtimeSchema?: number;
    runtimeSchemaValid?: boolean;
    interruptedTransaction: boolean;
    configDrift?: boolean;
    openCodeVersion?: string;
    agentDefinitions: string[];
    discoveredSkills: string[];
    warnings: string[];
    routingConfigPath?: string;
    routingConfigSchema?: number;
    routingConfigStrategy?: 'cost-quality' | 'quality' | 'cost';
    routingConfigRoleModels?: Record<string, string[]>;
    routingConfigSchemaValid?: boolean;
}
export declare function inspectProject(directory: string): ProjectInspection;
