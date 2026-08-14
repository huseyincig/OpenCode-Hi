import type { MissionState } from '../mission/types.js';
export declare const RUNTIME_STATE_SCHEMA: 8;
export interface PersistenceLoadReport {
    sourceSchema?: number;
    targetSchema: typeof RUNTIME_STATE_SCHEMA;
    loaded: number;
    error?: string;
    previousBootId?: string;
    uncleanShutdown?: boolean;
}
export declare class RuntimePersistence {
    readonly path: string;
    readonly bootId: string;
    readonly startedAt: number;
    previousBootId?: string;
    lastLoadReport: PersistenceLoadReport;
    constructor(projectRoot: string);
    load(): MissionState[];
    save(missions: MissionState[], cleanShutdown?: boolean): void;
    markRunning(missions: MissionState[]): void;
    markCleanShutdown(missions: MissionState[]): void;
}
