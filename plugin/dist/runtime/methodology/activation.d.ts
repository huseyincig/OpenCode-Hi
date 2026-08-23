import { type HiMethodologyProducer, type HiMethodologySignalName } from '../../generated/methodology-policy.js';
import type { HiMethodologyNeed, MissionState } from '../mission/types.js';
export declare function createMethodologyNeed(name: string, signal: HiMethodologySignalName, producer: HiMethodologyProducer, reason: string, extra?: Partial<Pick<HiMethodologyNeed, 'task_id' | 'obligation_id'>>, projectRoot?: string): HiMethodologyNeed;
export declare function activateMethodologySignal(mission: MissionState, projectRoot: string | undefined, input: {
    signal: HiMethodologySignalName;
    producer: HiMethodologyProducer;
    reason: string;
    taskId?: string;
    obligationId?: string;
}): string[];
export declare function methodologyNames(needs: readonly HiMethodologyNeed[]): string[];
export declare function bindMethodologyNeeds(mission: MissionState, names: readonly string[], input: {
    taskId: string;
    obligationIds?: readonly string[];
}): void;
export declare function releaseCancelledTaskMethodologyNeeds(mission: MissionState, taskId: string): string[];
export declare function bindParentMethodologyNeeds(mission: MissionState, names: readonly string[], obligationId: string): void;
export declare function suppressIntentMethodologySignals(mission: MissionState, signals: readonly HiMethodologySignalName[], reason: string): string[];
