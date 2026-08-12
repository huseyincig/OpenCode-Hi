import type { NormalizedMissionIntent, VerificationPolicy } from '../mission/types.js';
export type PrimaryMode = 'working-manager' | 'manager';
export interface MinimumTeamDecision {
    primary: PrimaryMode;
    direct: boolean;
    roles: string[];
    reason: string[];
}
export declare function minimumTeamFor(intent: NormalizedMissionIntent, verification?: VerificationPolicy, primaryMode?: 'auto' | PrimaryMode): MinimumTeamDecision;
