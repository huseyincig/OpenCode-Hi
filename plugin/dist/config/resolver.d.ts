import { type HiConfig, type ConfigResolutionReport } from './schema.js';
export declare function resolveHiConfigWithReport(raw: unknown, projectRoot?: string): {
    config: HiConfig;
    report: ConfigResolutionReport;
};
export declare function resolveHiConfig(raw: unknown, projectRoot?: string): HiConfig;
