import type { EvidenceItem, MethodologyObservation, MissionState, WorkerState } from '../mission/types.js';
import { type ProjectMethodologyCandidate } from './methodology-candidate.js';
export declare class ProjectMethodologyLearningStore {
    #private;
    readonly projectRoot: string;
    constructor(projectRoot: string);
    all(): ProjectMethodologyCandidate[];
    observe(mission: MissionState, worker: WorkerState, observation: MethodologyObservation, resultEvidence: readonly Pick<EvidenceItem, 'id' | 'kind'>[]): ProjectMethodologyCandidate | undefined;
}
