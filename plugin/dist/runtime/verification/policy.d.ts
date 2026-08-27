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
export declare function verificationEconomyInstruction(m: MissionState, ownedKinds?: string[]): string;
export declare function verificationKindSatisfiesRequirement(required: string, actual: string): boolean;
export declare function verificationKindAdmittedForMission(m: MissionState, actual: string): boolean;
export declare function verificationEnvelopeFor(m: MissionState, obligationID?: string, projectRoot?: string): VerificationEnvelope;
export declare function verificationSatisfied(m: MissionState, obligationID?: string, projectRoot?: string): {
    ok: boolean;
    missing: string[];
};
export declare function verificationClaimsSatisfied(m: MissionState, projectRoot?: string): {
    ok: boolean;
    missing: string[];
};
export declare function reviewObligationSatisfied(m: MissionState, obligationID: string, projectRoot?: string): {
    ok: boolean;
    reason?: string;
    evidence_id?: string;
};
export declare function reviewClaimsSatisfied(m: MissionState, projectRoot?: string): {
    ok: boolean;
    missing: string[];
};
export declare function latestBlockingVerificationEvidence(m: MissionState, obligationID?: string): EvidenceItem | undefined;
