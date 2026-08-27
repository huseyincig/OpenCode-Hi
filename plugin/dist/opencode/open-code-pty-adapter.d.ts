import type { OpenCodeClient } from './types.js';
import { type ProcessContract } from '../contracts/process.js';
import { type ProcessExecutor, type ProcessExit, type ProcessHandle, type ProcessOutput, type ProcessOutputWindow, type ProcessSpawnRequest, type ProcessReconcileResult } from '../runtime/process/executor.js';
export { ProcessSpawnPermissionError } from '../runtime/process/executor.js';
interface ProcessSocket {
    readyState: number;
    send(data: string): void;
    close(code?: number, reason?: string): void;
    addEventListener(type: 'open' | 'message' | 'close' | 'error', listener: (event: any) => void, options?: {
        once?: boolean;
    }): void;
}
export type ProcessSocketFactory = (url: string) => ProcessSocket;
export type ProcessSignal = (pid: number, signal: 'SIGTERM' | 'SIGINT' | 'SIGKILL') => void;
export type ProcessGroupResolver = (pid: number) => number | undefined;
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
    readonly terminationGraceMs: number;
    readonly terminationVerifyMs: number;
    constructor(client: OpenCodeClient, serverUrl: URL, directory: string, projectRoot: string, getHostConfig: () => Record<string, unknown>, socketFactory?: ProcessSocketFactory, signalProcess?: ProcessSignal, maxBufferedChars?: number, maxReadChars?: number, resolveProcessGroup?: ProcessGroupResolver, terminationGraceMs?: number, terminationVerifyMs?: number);
    health(): Promise<{
        available: boolean;
        detail: string;
    }>;
    spawn(request: ProcessSpawnRequest): Promise<ProcessHandle>;
    write(processId: string, input: string): Promise<void>;
    read(processId: string, window?: ProcessOutputWindow): Promise<ProcessOutput>;
    observe(processId: string): Promise<ProcessContract>;
    wait(processId: string): Promise<ProcessExit>;
    kill(processId: string, signal?: 'SIGTERM' | 'SIGINT'): Promise<ProcessExit>;
    cleanup(processId: string): Promise<void>;
    reconcile(contract: ProcessContract): Promise<ProcessReconcileResult>;
    snapshot(processId: string): ProcessContract;
    list(): ProcessContract[];
}
