import type { MissionState } from '../mission/types.js';
export declare const DIAGNOSTIC_HYPOTHESIS_OUTCOMES: readonly ["SUPPORTED", "FALSIFIED", "INCONCLUSIVE"];
export type DiagnosticHypothesisOutcome = typeof DIAGNOSTIC_HYPOTHESIS_OUTCOMES[number];
export interface DiagnosticHypothesisAssessment {
    id: string;
    hypothesis: string;
    falsifier: string;
    outcome: DiagnosticHypothesisOutcome;
    evidence_refs: string[];
    admissible_evidence_refs: string[];
    rejected_evidence_refs: Array<{
        id: string;
        reason: string;
    }>;
    supported: boolean;
}
export declare function diagnosticHypothesisID(m: MissionState, hypothesis: string, falsifier: string): string;
export declare function assessDiagnosticHypothesis(m: MissionState, input: {
    hypothesis: string;
    falsifier: string;
    outcome: DiagnosticHypothesisOutcome;
    evidence_refs: string[];
}): DiagnosticHypothesisAssessment;
