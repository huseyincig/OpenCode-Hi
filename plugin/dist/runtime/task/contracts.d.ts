import { type WorkerResult } from '../mission/types.js';
export interface WorkerHandoff {
    objective: string;
    scope: string[];
    constraints: string[];
    required_evidence: string[];
    relevant_context: string[];
    methodologies: string[];
    methodology_exit_requirements?: string[];
    approval_gated_methodologies?: string[];
    expected_output: {
        status: true;
        summary: true;
        changed_files: true;
        scope_expansions: true;
        evidence: true;
        open_issues: true;
    };
}
export declare function workerHandoffText(h: WorkerHandoff, maxChars?: number): string;
export declare function normalizeWorkerResult(raw: unknown): WorkerResult;
