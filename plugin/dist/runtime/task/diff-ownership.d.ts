import type { MissionTask, WorkerResult } from '../mission/types.js';
export interface DiffOwnershipAssessment {
    outside: string[];
    accepted: string[];
    collateral: string[];
}
export interface ScopeExpansionClaim {
    file: string;
    reason: string;
    necessary: boolean;
}
export type ScopeExpansionAuthority = 'worker-proposal' | 'control-plane';
export declare function assessChangedFileOwnership(scopeInput: string[], changedInput: string[], scopeExpansions?: ScopeExpansionClaim[], authority?: ScopeExpansionAuthority): DiffOwnershipAssessment;
export declare function assessDiffOwnership(task: MissionTask, result: WorkerResult): DiffOwnershipAssessment;
