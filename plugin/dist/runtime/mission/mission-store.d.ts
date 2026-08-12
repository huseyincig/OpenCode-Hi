import { type NativeProjectContext } from '../intent/repo-context.js';
import type { MissionState } from './types.js';
export declare class MissionStore {
    #private;
    constructor(root?: string, nativeContext?: NativeProjectContext, getPrimaryMode?: () => 'auto' | 'working-manager' | 'manager');
    start(sessionID: string, userText: string): MissionState;
    get(sessionID: string): MissionState | undefined;
    amend(sessionID: string, userText: string, kind?: 'amend' | 'verification' | 'constraint'): void;
    restore(missions: MissionState[], uncleanShutdown?: boolean): void;
    remove(sessionID: string): void;
    stop(sessionID: string, reason?: string): void;
    noteUserMessage(sessionID: string): void;
    resume(sessionID: string, reason?: string): void;
    complete(sessionID: string): void;
    all(): MissionState[];
    updateProgress(m: MissionState, countStagnation?: boolean): boolean;
    closeObligation(m: MissionState, id: string): void;
    signature(m: MissionState): string;
}
