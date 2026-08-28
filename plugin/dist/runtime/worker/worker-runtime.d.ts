import type { Category, ExecutionProfile, MethodologyProvenance, MissionState, MissionTask, WorkerResult, WorkerState } from '../mission/types.js';
import { type ContextReferenceDraft } from '../../contracts/context-reference.js';
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
    contextReferences?: ContextReferenceDraft[];
    verificationCases?: import('../../contracts/verification-case.js').VerificationCase[];
    executionProfile?: ExecutionProfile;
}): MissionTask;
export declare function createWorker(m: MissionState, task: MissionTask, model?: string, fallbacks?: string[], selectedMethodologies?: string[], methodologyProvenanceItems?: MethodologyProvenance[]): WorkerState;
export declare function workerAttemptPromptMessageID(worker: WorkerState, at: number): string;
export declare function beginWorkerAttempt(task: MissionTask, worker: WorkerState, at?: number): void;
export declare function retireTaskResultIssues(m: MissionState, taskID: string, issues: string[], replacementIssues?: string[]): string[];
export declare function applyWorkerResult(m: MissionState, task: MissionTask, worker: WorkerState, result: WorkerResult): void;
