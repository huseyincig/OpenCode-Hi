import type { MissionState, RuntimeNudge } from '../mission/types.js';
export declare function setRuntimeNudge(m: MissionState, instruction: string, reason: string, task_id?: string, worker_id?: string): RuntimeNudge;
