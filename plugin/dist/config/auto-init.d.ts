import { type ModelRoutedChildRole } from './schema.js';
export declare const DEFAULT_STRATEGY: 'cost-quality';
export type InitialRoleRecommendations = Partial<Record<ModelRoutedChildRole, string[]>>;
export declare function defaultProjectRoutingConfig(initialRecommendations?: InitialRoleRecommendations): {
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
export declare function ensureProjectRoutingConfig(projectRoot: string, initialRecommendations?: InitialRoleRecommendations): {
    created: boolean;
    path: string;
    configuredRoles?: number;
    reason?: string;
};
export declare function setProjectRoleModels(projectRoot: string, role: ModelRoutedChildRole, models: string[]): {
    path: string;
    roleModels: Record<string, string[]>;
};
