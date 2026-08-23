import { type ModelRoutedChildRole, type TopologyMode } from "./schema.js";
export type HiWorkMode = "adaptive" | "single" | "multi";
export interface ProjectSettingsPatch {
    workMode?: HiWorkMode;
    maxAgents?: number;
    parallelism?: number;
    allowedModels?: string[] | null;
    roleModels?: Partial<Record<ModelRoutedChildRole, string[] | null>>;
    resetRoleModels?: boolean;
}
export interface ProjectSettingsResult {
    path: string;
    workMode: HiWorkMode;
    execution: {
        topology: TopologyMode;
        maxAgents?: number;
        parallelism?: number;
    };
    roleModels: Record<string, string[]>;
    allowedModels: string[];
}
export declare function projectSettingsPath(projectRoot: string): string;
export declare function hasProjectSettings(projectRoot: string): boolean;
export declare function readProjectSettingsDocument(projectRoot: string): {
    path: string;
    doc: Record<string, any>;
};
export declare function applyProjectSettings(projectRoot: string, patch: ProjectSettingsPatch): ProjectSettingsResult;
