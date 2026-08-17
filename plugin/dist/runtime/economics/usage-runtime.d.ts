import type { ExecutionUsageObservation, HostUsageObservation } from '../../contracts/execution-usage.js';
import type { MissionState, WorkerState } from '../mission/types.js';
export declare function bindWorkerUsageObservation(m: MissionState, worker: WorkerState, usage: HostUsageObservation, at?: number): ExecutionUsageObservation | undefined;
export declare function workerExactTokenUsage(worker: WorkerState): {
    input: number;
    output: number;
    reasoning: number;
    cache_read: number;
    cache_write: number;
};
export declare function workerDerivedOpenCodeCost(worker: WorkerState): number;
