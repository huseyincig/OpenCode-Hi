import type { NormalizedMissionIntent, VerificationPolicy, PrimaryMode } from '../mission/types.js';
export interface MinimumTeamDecision {
    primary: PrimaryMode;
    direct: boolean;
    roles: string[];
    reason: string[];
}
export declare function minimumTeamFor(intent: NormalizedMissionIntent, verification?: VerificationPolicy, primaryMode?: 'auto' | PrimaryMode): MinimumTeamDecision;
