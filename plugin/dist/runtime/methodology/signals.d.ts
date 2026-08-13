import type { NormalizedMissionIntent } from '../mission/types.js';
import type { HiMethodologySignalName } from '../../generated/methodology-policy.js';
export interface HiMethodologySignal {
    name: HiMethodologySignalName;
    reason: string;
}
export declare function changedSurfaceMethodologySignals(files: string[]): HiMethodologySignal[];
export declare function workerResultMethodologySignals(input: {
    status: string;
    needsContext?: string[];
    contextGap?: 'scope' | 'iterative' | 'none';
    failureFinding?: 'ci-build' | 'unknown-root-cause' | 'none';
}): HiMethodologySignal[];
export declare function verificationMethodologySignals(input: {
    changed: boolean;
    scopeExpanded: boolean;
    riskEscalated: boolean;
    requireReview: boolean;
    changedFiles: string[];
}): HiMethodologySignal[];
export declare function architectureMethodologySignals(intent: NormalizedMissionIntent): HiMethodologySignal[];
