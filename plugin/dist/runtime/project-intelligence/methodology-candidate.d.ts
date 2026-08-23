import type { MethodologyObservation } from '../mission/types.js';
export type MethodologyLearningOutcome = 'helpful' | 'harmful';
export interface MethodologyCandidateObservation {
    mission_id: string;
    task_id: string;
    worker_id: string;
    evidence: string[];
    observed_at: number;
    outcome?: MethodologyLearningOutcome;
}
export interface MethodologyCandidateLearning {
    alpha: number;
    beta: number;
    positive: number;
    negative: number;
    last_positive_at: number;
    last_negative_at?: number;
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
    learning?: MethodologyCandidateLearning;
    created_at: number;
    updated_at: number;
}
export interface MethodologyCandidateAssessment {
    eligible: boolean;
    reason: 'archived' | 'insufficient-independent-evidence' | 'confidence-below-floor' | 'admitted';
    positive: number;
    negative: number;
    independent_tasks: number;
    posterior_confidence: number;
    effective_confidence: number;
    age_days: number;
    half_life_days: number;
    freshness: 'FRESH' | 'DECAYED';
}
export declare const PROJECT_METHODOLOGY_CONFIDENCE_DECAY_DAYS = 30;
export declare const PROJECT_METHODOLOGY_READY_CONFIDENCE = 0.7;
export declare function methodologyCandidateDigest(o: Pick<MethodologyObservation, 'key' | 'procedure' | 'trigger' | 'do_not_trigger' | 'exit_condition'>): string;
export declare function methodologyCandidateID(o: Pick<MethodologyObservation, 'key' | 'procedure' | 'trigger' | 'do_not_trigger' | 'exit_condition'>): string;
export declare function methodologyCandidateLearning(candidate: ProjectMethodologyCandidate): MethodologyCandidateLearning;
export declare function methodologyCandidateAssessment(candidate: ProjectMethodologyCandidate, now?: number): MethodologyCandidateAssessment;
export declare function withDerivedMethodologyLearning(candidate: ProjectMethodologyCandidate): ProjectMethodologyCandidate;
export declare function validProjectMethodologyCandidate(raw: unknown): raw is ProjectMethodologyCandidate;
export declare function readProjectMethodologyCandidate(projectRoot: string, id: string): ProjectMethodologyCandidate | undefined;
