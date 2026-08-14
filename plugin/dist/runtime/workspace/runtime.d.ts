import type { IsolationDecisionContract, WorkspaceLeaseContract } from '../../contracts/workspace.js';
import type { MissionState, MissionTask } from '../mission/types.js';
import type { WorkspaceExecutor } from './executor.js';
export declare class WorkspaceRuntime {
    readonly executor: WorkspaceExecutor;
    readonly projectRoot: string;
    constructor(executor: WorkspaceExecutor, projectRoot: string);
    decision(m: MissionState, task: MissionTask, input: {
        required: boolean;
        reason: string;
    }): IsolationDecisionContract;
    provision(m: MissionState, task: MissionTask, decision: IsolationDecisionContract): Promise<WorkspaceLeaseContract>;
    forTask(m: MissionState, taskID: string): WorkspaceLeaseContract | undefined;
    cleanup(m: MissionState, leaseID: string): Promise<boolean>;
    cleanupTask(m: MissionState, taskID: string): Promise<boolean>;
    cleanupMission(m: MissionState): Promise<number>;
    reconcileRestored(missions: MissionState[]): Promise<void>;
}
