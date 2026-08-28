export { normalizeWorkerResult } from '../../contracts/worker-result.js';
export interface WorkerHandoff {
    objective: string;
    scope: string[];
    constraints: string[];
    required_evidence: string[];
    relevant_context: string[];
    methodologies: string[];
    methodology_exit_requirements?: string[];
    approval_gated_methodologies?: string[];
    result_contract_instructions?: string[];
    expected_output: {
        status: true;
        summary: true;
        changed_files: true;
        scope_expansions: true;
        evidence: true;
        findings?: true;
        open_issues: true;
    };
}
export declare function workerHandoffText(h: WorkerHandoff, maxChars?: number): string;
