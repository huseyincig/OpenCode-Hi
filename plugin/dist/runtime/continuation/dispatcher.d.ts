import type { HostPort } from '../host/port.js';
import type { MissionState } from '../mission/types.js';
export declare function dispatchContinuation(host: Pick<HostPort, 'continueSession' | 'sessionStatus'>, mission: MissionState, prompt: string, reason: string): Promise<boolean>;
