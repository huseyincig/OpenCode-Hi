import type { NormalizedMissionIntent } from '../mission/types.js';
export type IsolationLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNTRUSTED';
export interface IsolationDecision {
    level: IsolationLevel;
    mechanism: 'current-workspace' | 'git-worktree' | 'isolated-environment' | 'restricted-sandbox';
    reason: string;
}
export declare function decideIsolation(intent: NormalizedMissionIntent, untrusted?: boolean): IsolationDecision;
