import type { MissionState, WorkerState } from '../mission/types.js';
export declare function requestedMethodologyName(args: unknown): string | undefined;
export declare function assertChildMethodologyLoad(worker: WorkerState | undefined, name: string): void;
export declare function assertParentMethodologyLoad(mission: MissionState, name: string, projectRoot?: string): void;
export declare function recordParentMethodologyLoad(mission: MissionState, name: string): void;
export declare function recordChildMethodologyLoad(worker: WorkerState | undefined, name: string): void;
