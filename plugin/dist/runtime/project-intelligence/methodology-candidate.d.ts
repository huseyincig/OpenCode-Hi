import type { MethodologyObservation } from '../mission/types.js';
export interface MethodologyCandidateObservation {
    mission_id: string;
    task_id: string;
    worker_id: string;
    evidence: string[];
    observed_at: number;
}
export interface ProjectMethodologyCandidate {
    schema: 1;
    id: string;
    key: string;
    contract_sha256: string;
    procedure: string;
    trigger: string;
    do_not_trigger: string;
    exit_condition: string;
    state: 'CANDIDATE' | 'READY' | 'ARCHIVED';
    observations: MethodologyCandidateObservation[];
    created_at: number;
    updated_at: number;
}
export declare function methodologyCandidateDigest(o: Pick<MethodologyObservation, 'key' | 'procedure' | 'trigger' | 'do_not_trigger' | 'exit_condition'>): string;
export declare function methodologyCandidateID(o: Pick<MethodologyObservation, 'key' | 'procedure' | 'trigger' | 'do_not_trigger' | 'exit_condition'>): string;
export declare function validProjectMethodologyCandidate(raw: unknown): raw is ProjectMethodologyCandidate;
export declare function readProjectMethodologyCandidate(projectRoot: string, id: string): ProjectMethodologyCandidate | undefined;
