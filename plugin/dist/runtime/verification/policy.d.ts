import type { EvidenceItem, MissionState, MissionTask, NormalizedMissionIntent, VerificationPolicy } from '../mission/types.js';
import type { RepoContext } from '../intent/repo-context.js';
import type { VerificationEnvelope } from '../../contracts/verification-envelope.js';
export declare function verificationPolicyFor(intent: NormalizedMissionIntent): VerificationPolicy;
export interface VerificationReplan {
    changed: boolean;
    addedKinds: string[];
    scopeExpanded: boolean;
    riskEscalated: boolean;
    reason: string;
}
export declare function replanVerificationForChangedSurface(m: MissionState, task: MissionTask, files: string[], repo?: RepoContext): VerificationReplan;
export declare function verificationEconomyInstruction(m: MissionState): string;
export declare function verificationEnvelopeFor(m: MissionState, obligationID?: string): VerificationEnvelope;
export declare function verificationSatisfied(m: MissionState, obligationID?: string): {
    ok: boolean;
    missing: string[];
};
export declare function verificationClaimsSatisfied(m: MissionState): {
    ok: boolean;
    missing: string[];
};
export declare function reviewObligationSatisfied(m: MissionState, obligationID: string): {
    ok: boolean;
    reason?: string;
    evidence_id?: string;
};
export declare function reviewClaimsSatisfied(m: MissionState): {
    ok: boolean;
    missing: string[];
};
export declare function latestBlockingVerificationEvidence(m: MissionState, obligationID?: string): EvidenceItem | undefined;
