import { type SemanticIntentAssessment } from './semantic-assessment.js';
export interface SemanticRequestUnit {
    id: string;
    text: string;
}
export declare function semanticRequestUnits(text: string, limit?: number): SemanticRequestUnit[];
export declare function renderRequestUnitChallenge(text: string): string;
export declare function assertVerificationRequestTrace(text: string, assessment: SemanticIntentAssessment): void;
export declare function assertCapabilityRequestTrace(text: string, assessment: SemanticIntentAssessment): void;
