export type WorkerFailureClass = 'provider-transport' | 'permission' | 'environment' | 'tool-incompatibility' | 'context-overflow' | 'reasoning-task' | 'unknown';
export interface ClassifiedWorkerFailure {
    kind: WorkerFailureClass;
    stagnation: boolean;
    retryable: boolean;
    reason: string;
}
export declare function classifyWorkerFailure(error: unknown): ClassifiedWorkerFailure;
