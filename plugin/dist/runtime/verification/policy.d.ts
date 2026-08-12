import type { EvidenceItem, MissionState, MissionTask, NormalizedMissionIntent, VerificationPolicy } from '../mission/types.js';
import type { RepoContext } from '../intent/repo-context.js';
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
export declare function verificationSatisfied(m: MissionState, obligationID?: string): {
    ok: boolean;
    missing: string[];
};
export declare function latestBlockingVerificationEvidence(m: MissionState, obligationID?: string): EvidenceItem | undefined;
