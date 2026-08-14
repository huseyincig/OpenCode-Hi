export type VerificationCheckResult = 'passed' | 'failed' | 'pending' | 'environment-issue' | 'not_run';
export type VerificationFreshness = 'fresh' | 'stale';
export interface VerificationCheck {
    kind: string;
    subject: string;
    result: VerificationCheckResult;
    evidence_refs: string[];
    explanation?: string;
}
export interface VerificationEnvelope {
    checks: VerificationCheck[];
    scope: string[];
    freshness: VerificationFreshness;
    limitations: string[];
    independent_review: boolean;
}
export declare function isVerificationEnvelopeContract(v: unknown): v is VerificationEnvelope;
