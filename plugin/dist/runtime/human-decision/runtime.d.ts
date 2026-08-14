import type { MissionState } from '../mission/types.js';
import { type HumanDecisionContract, type HumanDecisionResponseSchema, type HumanDecisionType } from '../../contracts/human-decision.js';
export interface OpenHumanDecisionInput {
    semantic_type: HumanDecisionType;
    reason_code: string;
    summary: string;
    task_id?: string;
    worker_id?: string;
    response_schema: HumanDecisionResponseSchema;
    authority_ref?: string;
}
export declare function openHumanDecision(m: MissionState, input: OpenHumanDecisionInput): HumanDecisionContract;
export declare function resolveHumanDecision(m: MissionState, resolution: string, at?: number): HumanDecisionContract | undefined;
export declare function classifyRuntimeHumanDecision(reasonCode: string): Pick<OpenHumanDecisionInput, 'semantic_type' | 'response_schema'>;
