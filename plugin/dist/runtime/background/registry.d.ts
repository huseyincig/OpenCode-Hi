import type { WorkerState } from '../mission/types.js';
export declare class BackgroundRegistry {
    #private;
    list(): WorkerState[];
    get(id: string): WorkerState | undefined;
    set(w: WorkerState): void;
    delete(id: string): void;
    waitForChange(id: string, timeoutMs: number): Promise<boolean>;
    dedupeSpawn(fingerprint: string, spawn: () => Promise<WorkerState>): Promise<WorkerState>;
}
