import { type WorkerEvidenceKind } from './evidence-kinds.js';
export type ReviewFindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type ReviewFindingCausality = 'introduced' | 'worsened' | 'pre-existing' | 'unknown';
export type ReviewFindingConfidence = 'low' | 'medium' | 'high';
export type ReviewFindingDisposition = 'open' | 'resolved' | 'rejected' | 'parked';
export interface ReviewFinding {
    id: string;
    reviewer_role: string;
    subject: string;
    severity: ReviewFindingSeverity;
    causality: ReviewFindingCausality;
    scope: string[];
    evidence_refs: WorkerEvidenceKind[];
    confidence: ReviewFindingConfidence;
    disposition: ReviewFindingDisposition;
    blocking: boolean;
}
export declare function isReviewFindingContract(v: unknown): v is ReviewFinding;
export declare function reviewFindingNeedsCorrection(f: ReviewFinding): boolean;
export declare function reviewFindingMarker(f: ReviewFinding): string;
