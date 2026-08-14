import type { MissionState, WorkerState } from '../mission/types.js';
export interface MissionRuntimeProjection {
    objective: string;
    next_action: string;
    blockers: string[];
    obligations: string[];
    active_methodologies: string[];
    verification: string;
    authority: string;
    changed_files: string;
    task_worker: string;
}
export interface MissionRuntimeProjectionMeasurement {
    dynamic_chars: number;
}
export declare function buildMissionRuntimeProjection(m: MissionState, worker?: WorkerState): MissionRuntimeProjection;
export declare function renderMissionRuntimeProjection(p: MissionRuntimeProjection): string;
export declare function measureMissionRuntimeProjection(projection: MissionRuntimeProjection): MissionRuntimeProjectionMeasurement;
