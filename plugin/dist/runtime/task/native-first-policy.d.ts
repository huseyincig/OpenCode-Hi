export type OperationClass = 'static-repeatable' | 'dynamic-mission';
export interface NativeFirstTaskDecision {
    operation: OperationClass;
    preferred: 'opencode-command-subtask' | 'hhc-task-adapter';
    reason: string;
}
export declare function nativeFirstTaskDecision(operation: OperationClass): NativeFirstTaskDecision;
