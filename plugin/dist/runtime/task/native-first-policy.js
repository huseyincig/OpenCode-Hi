export function nativeFirstTaskDecision(operation) {
    return operation === 'static-repeatable'
        ? { operation, preferred: 'opencode-command-subtask', reason: 'Static repeatable operations should use native OpenCode commands/subtask where available.' }
        : { operation, preferred: 'hhc-task-adapter', reason: 'Dynamic mission work uses the thin HHC Task adapter over native OpenCode sessions.' };
}
