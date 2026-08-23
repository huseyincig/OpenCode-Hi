export type EvalDiagnosticStatus = 'NOT_PROVIDED' | 'INSUFFICIENT' | 'MEASURED';
export type JudgeAgreementBand = 'LESS_THAN_CHANCE' | 'SLIGHT' | 'FAIR' | 'MODERATE' | 'SUBSTANTIAL' | 'ALMOST_PERFECT';
export interface EvalDistributionSummary {
    sample_count: number;
    mean: number;
    sample_stddev: number;
    confidence_level: 0.95;
    confidence_interval_95: [number, number];
}
export interface EvalJudgeAgreement {
    status: EvalDiagnosticStatus;
    item_count: number;
    judge_count: number;
    fleiss_kappa?: number;
    band?: JudgeAgreementBand;
}
export interface EvalEvidenceFamilyDiversity {
    status: EvalDiagnosticStatus;
    evidence_count: number;
    unique_family_count: number;
    largest_family_count: number;
    largest_family_share: number;
    families: Record<string, number>;
}
export interface EvalUncertaintyDiagnostics {
    advisory_only: true;
    wall_time_ms: EvalDistributionSummary;
    judge_agreement: EvalJudgeAgreement;
    evidence_family_diversity: EvalEvidenceFamilyDiversity;
    flags: Array<'JUDGE_DISAGREEMENT' | 'INSUFFICIENT_JUDGE_DATA' | 'INSUFFICIENT_EVIDENCE_DIVERSITY' | 'LOW_EVIDENCE_FAMILY_DIVERSITY'>;
}
export declare function sampleDistribution95(values: readonly number[]): EvalDistributionSummary;
export declare function fleissKappaBinary(matrix: readonly (readonly number[])[]): EvalJudgeAgreement;
export declare function evidenceFamilyDiversity(families: readonly string[]): EvalEvidenceFamilyDiversity;
export declare function buildEvalUncertaintyDiagnostics(input: {
    wall_times_ms: readonly number[];
    judge_scores?: readonly (readonly number[])[];
    evidence_families?: readonly string[];
}): EvalUncertaintyDiagnostics;
