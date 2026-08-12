import type { MissionTask, WorkerResult } from '../mission/types.js';
export interface DiffOwnershipAssessment {
    outside: string[];
    accepted: string[];
    collateral: string[];
}
export declare function assessDiffOwnership(task: MissionTask, result: WorkerResult): DiffOwnershipAssessment;
