import type { MissionState } from '../mission/types.js';
export declare function claimAction(m: MissionState, actionID: string, payload: unknown): 'new' | 'duplicate' | 'conflict';
export declare function payloadHash(payload: unknown): string;
