import type { MissionState, MissionTask, WorkerResult, WorkerState } from '../mission/types.js';
import { type TaskOutcomeMemoryRecord } from '../../contracts/task-outcome-memory.js';
export declare function taskOutcomeMemoryFingerprint(m: MissionState, task: MissionTask): string;
export declare function taskOutcomeIssueClasses(m: MissionState, task: MissionTask, worker: WorkerState, result: WorkerResult): string[];
export interface PriorTaskOutcomeHint {
    outcome: TaskOutcomeMemoryRecord['outcome'];
    attempt: number;
    issue_classes: string[];
    failure_finding?: TaskOutcomeMemoryRecord['failure_finding'];
}
export declare class ProjectTaskOutcomeMemoryStore {
    #private;
    readonly projectRoot: string;
    readonly path: string;
    constructor(projectRoot: string);
    observe(m: MissionState, task: MissionTask, worker: WorkerState, result: WorkerResult): TaskOutcomeMemoryRecord | undefined;
    recall(m: MissionState, task: MissionTask): PriorTaskOutcomeHint[];
    renderAdvisory(m: MissionState, task: MissionTask, maxChars?: number): string | undefined;
    records(): TaskOutcomeMemoryRecord[];
}
