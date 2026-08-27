import type { ExecutionAttemptIdentity, SchedulerLifecycleResult, SchedulerReservation, SchedulingSnapshot, SchedulingUnitDecision } from '../../contracts/orchestration-core.js';
import type { MissionState, WorkerState } from '../mission/types.js';
import type { ConcurrencyPolicySource } from './concurrency.js';
import { type ProjectSchedulingPeerView } from './project-peer-view.js';
export interface TaskRuntimeSchedulingOverride {
    workerId: string;
    model?: string;
    resumeTaskId?: string;
}
export declare function taskRuntimeSchedulingSnapshot(m: MissionState, scheduler: ConcurrencyPolicySource, override?: TaskRuntimeSchedulingOverride, peerView?: ProjectSchedulingPeerView): SchedulingSnapshot;
export declare function taskRuntimeUnitDecision(m: MissionState, worker: WorkerState, model: string | undefined, scheduler: ConcurrencyPolicySource, peerView?: ProjectSchedulingPeerView): SchedulingUnitDecision | undefined;
export declare function taskRuntimeAdmittedModel(m: MissionState, worker: WorkerState, models: string[], scheduler: ConcurrencyPolicySource, peerView?: ProjectSchedulingPeerView, resumeTaskId?: string): string | undefined;
export interface TaskRuntimeReservationResult extends SchedulerLifecycleResult {
    attempt?: ExecutionAttemptIdentity;
    reservation?: SchedulerReservation;
}
export declare function reserveTaskRuntimeDispatch(m: MissionState, worker: WorkerState, model: string | undefined, scheduler: ConcurrencyPolicySource, at?: number, peerView?: ProjectSchedulingPeerView, resumeTaskId?: string): TaskRuntimeReservationResult;
export declare function bindTaskRuntimeHost(m: MissionState, workerID: string, hostExecutionId: string, at?: number): SchedulerLifecycleResult;
export declare function beginTaskRuntimeSettlement(m: MissionState, worker: WorkerState, at?: number): SchedulerLifecycleResult;
export declare function releaseTaskRuntimeReservation(m: MissionState, workerID: string, kind?: 'RELEASE' | 'CANCEL', at?: number): SchedulerLifecycleResult;
export declare function reconcileTaskRuntimeRestart(m: MissionState, worker: WorkerState, outcome: 'ACTIVE' | 'TERMINAL' | 'UNKNOWN', at?: number): SchedulerLifecycleResult;
export declare function taskRuntimeReservation(m: MissionState, workerID: string): SchedulerReservation | undefined;
