import { type HhcConfig, type ConfigResolutionReport } from './schema.js';
export declare function resolveHhcConfigWithReport(raw: unknown, projectRoot?: string): {
    config: HhcConfig;
    report: ConfigResolutionReport;
};
export declare function resolveHhcConfig(raw: unknown, projectRoot?: string): HhcConfig;
