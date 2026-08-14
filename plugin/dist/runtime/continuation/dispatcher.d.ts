import type { OpenCodeClient } from '../../opencode/types.js';
import type { MissionState } from '../mission/types.js';
export declare function dispatchContinuation(client: OpenCodeClient, mission: MissionState, prompt: string, reason: string): Promise<boolean>;
