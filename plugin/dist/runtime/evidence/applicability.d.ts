import type { EvidenceItem, MissionState } from "../mission/types.js";
export interface EvidenceClaimApplicability {
    applicable: boolean;
    reasons: string[];
}
export declare function evidenceProducerAttemptForWorker(m: MissionState, worker: MissionState['execution']['workers'][number]): {
    worker_id: string;
    execution_unit_id: string;
    attempt_id: string;
    run_id: string;
    ordinal: number;
    generation: number;
};
/** Claim identity only. Freshness/invalidation is evaluated separately. */
export declare function evidenceClaimApplicability(m: MissionState, e: EvidenceItem, obligationID?: string): EvidenceClaimApplicability;
