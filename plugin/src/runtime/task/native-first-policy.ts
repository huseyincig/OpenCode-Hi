export type OperationClass='static-repeatable'|'dynamic-mission'
export interface NativeFirstTaskDecision{operation:OperationClass;preferred:'opencode-command-subtask'|'hhc-task-adapter';reason:string}
export function nativeFirstTaskDecision(operation:OperationClass):NativeFirstTaskDecision{
  return operation==='static-repeatable'
    ?{operation,preferred:'opencode-command-subtask',reason:'Static repeatable operations should use native OpenCode commands/subtask where available.'}
    :{operation,preferred:'hhc-task-adapter',reason:'Dynamic mission work uses the thin HHC Task adapter over native OpenCode sessions.'}
}
