export declare const DEFAULT_ROLE_MODELS_OPENCODE_GO: Record<string, string[]>;
export declare const DEFAULT_STRATEGY: 'cost-quality';
export declare function defaultProjectRoutingConfig(availableModelIDs?: string[]): {
    schema: 1;
    type: 'hi-routing';
    routing: {
        strategy: 'cost-quality';
        modelPolicy: 'recommended';
        roleModels: Record<string, string[]>;
        roleVariants: Record<string, Record<string, string>>;
        adaptiveRoles: string[];
    };
    applied_at: number;
    applied_by: string;
};
export declare function ensureProjectRoutingConfig(projectRoot: string, availableModelIDs?: string[]): {
    created: boolean;
    path: string;
    configuredRoles?: number;
    reason?: string;
};
