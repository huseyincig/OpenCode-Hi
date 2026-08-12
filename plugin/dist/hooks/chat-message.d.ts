import { MissionStore } from '../runtime/mission/mission-store.js';
export type FollowupKind = 'amend' | 'verification' | 'constraint';
export declare function classifyFollowup(text: string): FollowupKind | undefined;
export declare function createChatMessageHook(store: MissionStore, onStop?: (sessionID: string) => Promise<void>, onAmend?: (sessionID: string, text: string, kind: FollowupKind) => Promise<void>): (input: any, output: any) => Promise<void>;
