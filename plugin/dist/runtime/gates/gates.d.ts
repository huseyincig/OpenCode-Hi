import type { MissionGate, MissionState } from '../mission/types.js';
import { verificationClaimsSatisfied, reviewClaimsSatisfied } from '../verification/policy.js';
export interface MissionGateClaims {
    verification: ReturnType<typeof verificationClaimsSatisfied>;
    review: ReturnType<typeof reviewClaimsSatisfied>;
}
export declare function syncMissionGates(m: MissionState, projectRoot?: string, claims?: MissionGateClaims): MissionGate[];
