import type { Category, ContextArtifact, ExecutionProfile, MethodologyProvenance, MissionState, MissionTask, WorkerResult, WorkerState } from '../mission/types.js';
export declare function workerFingerprint(role: string, category: Category, model: string | undefined, taskFamily: string, objective?: string, contract?: {
    scope?: string[];
    constraints?: string[];
    dependencies?: string[];
    requiredEvidence?: string[];
    obligationIds?: string[];
}): string;
export declare function createTask(m: MissionState, input: {
    objective: string;
    role: string;
    category: Category;
    scope?: string[];
    constraints?: string[];
    dependencies?: string[];
    requiredEvidence?: string[];
    obligationIds?: string[];
    contextArtifacts?: ContextArtifact[];
    executionProfile?: ExecutionProfile;
}): MissionTask;
export declare function createWorker(m: MissionState, task: MissionTask, model?: string, fallbacks?: string[], skills?: string[], methodologies?: MethodologyProvenance[]): WorkerState;
export declare function applyWorkerResult(m: MissionState, task: MissionTask, worker: WorkerState, result: WorkerResult): void;
