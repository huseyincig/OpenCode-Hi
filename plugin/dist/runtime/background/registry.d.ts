import type { WorkerState } from '../mission/types.js';
export declare class BackgroundRegistry {
    #private;
    list(): WorkerState[];
    get(id: string): WorkerState | undefined;
    set(w: WorkerState): void;
    delete(id: string): void;
    pendingFor(parent: string): WorkerState[];
    dedupeSpawn(fingerprint: string, spawn: () => Promise<WorkerState>): Promise<WorkerState>;
}
