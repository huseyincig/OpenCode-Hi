import { type ModelRoutedChildRole } from './schema.js';
export declare function setProjectRoleModels(projectRoot: string, role: ModelRoutedChildRole, models: string[]): {
    path: string;
    roleModels: Record<string, string[]>;
};
