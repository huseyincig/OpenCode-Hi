import { MissionStore } from '../runtime/mission/mission-store.js';
export declare function createChatMessageHook(store: MissionStore, onFollowupPending?: (sessionID: string, text: string) => Promise<void>): (input: any, output: any) => Promise<void>;
