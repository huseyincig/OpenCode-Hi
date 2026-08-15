import type { MissionState } from '../mission/types.js';
import type { ProcessContract } from '../../contracts/process.js';
import { type ProcessExecutor, type ProcessOutput } from './executor.js';
import { type ProcessPermissionRequest } from './authority.js';
export type NativePermissionPrompter = (request: ProcessPermissionRequest) => Promise<void>;
export interface ProcessStartInput {
    worker_id: string;
    command: string;
    args?: string[];
    cwd: string;
    env?: Record<string, string>;
    title?: string;
    timeout_ms?: number;
    ask?: NativePermissionPrompter;
}
export declare class ProcessRuntime {
    readonly executor: ProcessExecutor;
    readonly projectRoot: string;
    readonly getHostConfig: () => Record<string, unknown>;
    constructor(executor: ProcessExecutor, projectRoot: string, getHostConfig: () => Record<string, unknown>);
    private contract;
    spawn(m: MissionState, input: ProcessStartInput): Promise<ProcessContract>;
    write(m: MissionState, id: string, input: string): Promise<void>;
    read(m: MissionState, id: string, cursor?: number, maxChars?: number): Promise<ProcessOutput>;
    private noteExit;
    wait(m: MissionState, id: string): Promise<ProcessContract>;
    kill(m: MissionState, id: string, signal?: 'SIGTERM' | 'SIGINT'): Promise<ProcessContract>;
    cleanup(m: MissionState, id: string): Promise<void>;
    list(m: MissionState): ProcessContract[];
    stopMission(m: MissionState): Promise<number>;
    reconcileRestored(missions: MissionState[]): Promise<void>;
}
