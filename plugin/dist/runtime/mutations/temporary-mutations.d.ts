import type { MissionState, TemporaryMutation } from '../mission/types.js';
export declare function registerTemporaryMutation(m: MissionState, input: {
    kind: string;
    description: string;
    rollback_command?: string;
    rollback_mode?: 'command' | 'native-revert';
    session_id?: string;
    message_id?: string;
}): TemporaryMutation;
export declare function matchRollback(m: MissionState, command: string): TemporaryMutation | undefined;
export declare function resolveRollback(m: MissionState, item: TemporaryMutation, success: boolean, detail?: string): void;
