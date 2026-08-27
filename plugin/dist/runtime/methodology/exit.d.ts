import type { MissionState, MissionTask, WorkerResult, WorkerState } from '../mission/types.js';
import { type HiMethodologyExitRequirement } from '../../generated/methodology-policy.js';
export interface MethodologyExitCheck {
    ok: boolean;
    missing: HiMethodologyExitRequirement[];
}
export declare function methodologyExitCheck(m: MissionState, name: string, input?: {
    task?: MissionTask;
    worker?: WorkerState;
    result?: WorkerResult;
    projectRoot?: string;
    scope?: 'worker' | 'mission';
    obligationId?: string;
}): MethodologyExitCheck;
export declare function loadedMethodologyNeedNames(m: MissionState): Set<string>;
export declare function reconcileMethodologyExits(m: MissionState, projectRoot?: string): string[];
