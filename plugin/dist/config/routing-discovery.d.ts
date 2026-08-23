import { type HiConfig } from './schema.js';
export interface ProjectRoutingConfigLoad {
    config: Partial<HiConfig>;
    legacyModelRoutingFields: string[];
}
export declare function loadProjectRoutingConfig(projectRoot: string): ProjectRoutingConfigLoad | undefined;
