import type { OpenCodeClient } from './types.js';
import { type ProcessContract } from '../contracts/process.js';
import type { ProcessExecutor, ProcessExit, ProcessHandle, ProcessOutput, ProcessOutputWindow, ProcessSpawnRequest, ProcessReconcileResult } from '../runtime/process/executor.js';
interface ProcessSocket {
    readyState: number;
    send(data: string): void;
    close(code?: number, reason?: string): void;
    addEventListener(type: 'open' | 'message' | 'close' | 'error', listener: (event: any) => void, options?: {
        once?: boolean;
    }): void;
}
export type ProcessSocketFactory = (url: string) => ProcessSocket;
export type ProcessSignal = (pid: number, signal: 'SIGTERM' | 'SIGINT') => void;
export type ProcessGroupResolver = (pid: number) => number | undefined;
export declare class ProcessSpawnPermissionError extends Error {
    readonly decision: 'ASK' | 'DENY';
    readonly reason: string;
    constructor(decision: 'ASK' | 'DENY', reason: string);
}
export declare function linuxProcessGroup(pid: number): number | undefined;
export declare class OpenCodePtyAdapter implements ProcessExecutor {
    #private;
    readonly client: OpenCodeClient;
    readonly serverUrl: URL;
    readonly directory: string;
    readonly projectRoot: string;
    readonly getHostConfig: () => Record<string, unknown>;
    readonly socketFactory: ProcessSocketFactory;
    readonly signalProcess: ProcessSignal;
    readonly maxBufferedChars: number;
    readonly maxReadChars: number;
    readonly resolveProcessGroup: ProcessGroupResolver;
    constructor(client: OpenCodeClient, serverUrl: URL, directory: string, projectRoot: string, getHostConfig: () => Record<string, unknown>, socketFactory?: ProcessSocketFactory, signalProcess?: ProcessSignal, maxBufferedChars?: number, maxReadChars?: number, resolveProcessGroup?: ProcessGroupResolver);
    spawn(request: ProcessSpawnRequest): Promise<ProcessHandle>;
    write(processId: string, input: string): Promise<void>;
    read(processId: string, window?: ProcessOutputWindow): Promise<ProcessOutput>;
    wait(processId: string): Promise<ProcessExit>;
    kill(processId: string, signal?: 'SIGTERM' | 'SIGINT'): Promise<ProcessExit>;
    cleanup(processId: string): Promise<void>;
    reconcile(contract: ProcessContract): Promise<ProcessReconcileResult>;
    snapshot(processId: string): ProcessContract;
    list(): ProcessContract[];
}
export {};
