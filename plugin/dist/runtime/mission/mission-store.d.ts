import { type SemanticIntentAssessment } from '../intent/semantic-assessment.js';
import { type NativeProjectContext } from '../intent/repo-context.js';
import { type TopologyPolicyConfig } from '../execution/topology-policy.js';
import type { MissionState } from './types.js';
export declare class MissionStore {
    #private;
    constructor(root?: string, nativeContext?: NativeProjectContext, getPrimaryMode?: () => 'auto' | 'working-manager' | 'manager', getTopology?: () => TopologyPolicyConfig);
    start(sessionID: string, userText: string, observedPrimary?: MissionState['execution']['primary_mode']): MissionState;
    applyInitialSemanticAssessment(sessionID: string, assessment: SemanticIntentAssessment): MissionState;
    bindObservedPrimary(sessionID: string, primary: MissionState['execution']['primary_mode']): void;
    get(sessionID: string): MissionState | undefined;
    beginFollowupSemanticAssessment(sessionID: string, userText: string): MissionState;
    applyFollowupSemanticAssessment(sessionID: string, assessment: SemanticIntentAssessment): MissionState;
    restore(missions: MissionState[], uncleanShutdown?: boolean): void;
    remove(sessionID: string): void;
    stop(sessionID: string, reason?: string): void;
    noteUserMessage(sessionID: string): void;
    resume(sessionID: string, reason?: string): void;
    complete(sessionID: string): void;
    all(): MissionState[];
    private syncProgressBaseline;
    updateProgress(m: MissionState, countStagnation?: boolean): boolean;
    closeObligation(m: MissionState, id: string): void;
    signature(m: MissionState): string;
}
