import type { EvidenceItem, MissionState } from '../mission/types.js';
export declare function markMutation(mission: MissionState, files?: string[], source?: string): void;
export declare function addEvidence(mission: MissionState, input: Omit<EvidenceItem, 'id' | 'observed_at'> & {
    observed_at?: number;
}): EvidenceItem;
export declare function observeToolBefore(mission: MissionState, tool: string, args: any): void;
export declare function observeToolAfter(mission: MissionState, tool: string, args: any, output: any): void;
