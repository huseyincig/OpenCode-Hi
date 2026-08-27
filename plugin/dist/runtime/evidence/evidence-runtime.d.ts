import type { EvidenceItem, MissionState } from '../mission/types.js';
import type { EvidenceProducerAttempt, EvidenceSourceClass } from '../../contracts/evidence.js';
import type { MissionEvidenceKind } from '../../contracts/evidence.js';
export declare function shellMayMutate(command: string): boolean;
export declare function verificationCommandKind(command: string): MissionEvidenceKind | undefined;
export declare function isVerificationCommand(command: string): boolean;
export declare function toolMayMutate(tool: string, args: any): boolean;
export declare function normalizeProjectPath(value: string, projectRoot?: string): string;
export declare function markMutation(mission: MissionState, files?: string[], source?: string): void;
export declare function addEvidence(mission: MissionState, input: Omit<EvidenceItem, 'id' | 'observed_at'> & {
    observed_at?: number;
}): EvidenceItem;
export declare function reconcileEvidenceOwnedVerificationObligations(mission: MissionState, projectRoot?: string, context?: {
    task_id?: string;
    worker_id?: string;
    owner?: string;
}): string[];
export declare function observeToolBefore(mission: MissionState, tool: string, args: any, projectRoot?: string): void;
export interface ToolEvidenceOwner {
    source: string;
    trusted_source_class: EvidenceSourceClass;
    source_session_id: string;
    task_id: string;
    obligation_ids: string[];
    scope: string[];
    producer_attempt: EvidenceProducerAttempt;
}
export declare function observeToolAfter(mission: MissionState, tool: string, args: any, output: any, projectRoot?: string, owner?: ToolEvidenceOwner): void;
