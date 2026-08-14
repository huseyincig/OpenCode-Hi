import { MissionStore } from '../runtime/mission/mission-store.js';
import type { ChatHumanDecisionTransport } from '../runtime/human-decision/transport.js';
export declare function createChatMessageHook(store: MissionStore, onFollowupPending?: (sessionID: string, text: string) => Promise<void>, humanDecisionTransport?: ChatHumanDecisionTransport): (input: any, output: any) => Promise<void>;
