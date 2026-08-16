import type { WorkGraph } from '../../contracts/orchestration-core.js';
import type { MissionState } from '../mission/types.js';
/**
 * Side-effect-free compatibility projection from the current durable runtime.
 * This does not replace Mission/Task/Worker ownership; it proves the new core
 * boundary can represent current orchestration state before migration begins.
 */
export declare function projectMissionToWorkGraph(mission: MissionState, observedAt?: number): WorkGraph;
