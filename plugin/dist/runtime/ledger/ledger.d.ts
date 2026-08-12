import type { LedgerEvent, MissionState } from '../mission/types.js';
export declare function appendLedger(mission: MissionState, type: string, detail?: Omit<LedgerEvent, 'id' | 'at' | 'mission_id' | 'type'>): LedgerEvent;
