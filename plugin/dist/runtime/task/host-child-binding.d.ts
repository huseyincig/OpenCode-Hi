import { type ExecutionAttemptIdentity } from '../../contracts/orchestration-core.js';
import type { MissionState, WorkerState } from '../mission/types.js';
import type { ChildSessionPort, HostChildSessionStatus } from '../host/port.js';
export interface HostChildBinding {
    missionId: string;
    taskId: string;
    workerId: string;
    parentSessionId: string;
    sessionId: string;
    generation: number;
    attempt: ExecutionAttemptIdentity;
}
export type HostTerminalEventDecision = 'ACCEPT' | 'WAIT' | 'STALE' | 'UNVERIFIED';
export interface HostTerminalEventAdmission {
    decision: HostTerminalEventDecision;
    reason: string;
    hostStatus: HostChildSessionStatus;
    binding?: HostChildBinding;
}
export declare function hostChildBinding(m: MissionState, worker: WorkerState): HostChildBinding | undefined;
/**
 * Restart reconciliation may need to settle an immutable historical attempt after
 * the parent mission moved to a newer semantic generation. The worker's persisted
 * attempt identity remains authoritative; a matching scheduler reservation, when
 * present, must prove the same host session and exact attempt identity.
 */
export declare function restartHostChildBinding(m: MissionState, worker: WorkerState): HostChildBinding | undefined;
export declare function hostChildBindingMatches(m: MissionState, worker: WorkerState, binding: HostChildBinding): boolean;
export declare function restartHostChildBindingMatches(m: MissionState, worker: WorkerState, binding: HostChildBinding): boolean;
/**
 * Admit a host terminal event without creating a second execution-status owner.
 * OpenCode owns busy/retry/idle truth. Hi captures only the semantic attempt/session
 * fence, performs one read-only status projection, then revalidates the fence after
 * the await so a same-session newer attempt cannot be closed by a stale idle event.
 */
export declare function admitHostTerminalEvent(m: MissionState, worker: WorkerState, host: ChildSessionPort): Promise<HostTerminalEventAdmission>;
/** Restart-only admission for a persisted historical attempt. Normal callbacks remain generation-fenced. */
export declare function admitRestartHostTerminalEvent(m: MissionState, worker: WorkerState, host: ChildSessionPort): Promise<HostTerminalEventAdmission>;
