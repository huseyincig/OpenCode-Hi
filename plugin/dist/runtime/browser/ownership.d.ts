import type { MissionState, MissionTask, WorkerState } from '../mission/types.js';
export interface BrowserExecutionOwner {
    worker: WorkerState;
    task: MissionTask;
}
export declare function resolveBrowserExecutionOwner(mission: MissionState, input: {
    sessionID: string;
    workerID?: string;
    taskID?: string;
}): BrowserExecutionOwner | undefined;
