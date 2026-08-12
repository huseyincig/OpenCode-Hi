export type ProcessStatus = 'running' | 'exited' | 'failed' | 'stopped';
export interface ProcessState {
    processId: string;
    ownerTask: string;
    purpose: string;
    cwd: string;
    status: ProcessStatus;
    startedAt: number;
    expectedSignal?: string;
    cleanupPolicy: 'stop-on-mission-end' | 'retain' | 'handoff';
    exitCode?: number | null;
}
export declare class ProcessGovernor {
    #private;
    start(command: string, args: string[], input: {
        ownerTask: string;
        purpose: string;
        cwd: string;
        cleanupPolicy?: ProcessState['cleanupPolicy'];
        expectedSignal?: string;
    }): ProcessState;
    get(id: string): ProcessState | undefined;
    list(): ProcessState[];
    stop(id: string): boolean;
    cleanupMission(): string[];
}
