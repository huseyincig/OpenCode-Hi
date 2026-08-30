import type { HostUsageObservation } from '../../contracts/execution-usage.js'
import type { AvailableModel } from '../routing/model-resolver.js'
import type { HostCapabilityContract } from '../../contracts/host-capability.js'

export type HostLogLevel='debug'|'info'|'warn'|'error'
export type HostEventKind=
  | 'session-idle'|'session-error'|'session-deleted'|'session-status'|'session-diff'|'session-compacted'|'assistant-message-updated'
  | 'todo-updated'|'permission-asked'|'permission-replied'|'file-edited'|'file-watcher-updated'
  | 'lsp-diagnostics'|'installation-updated'|'unknown'

export interface HostEvent{
  kind:HostEventKind
  rawType:string
  sessionID?:string
  properties:Record<string,any>
  filePaths:string[]
  status:string
  permission?:{id?:string;reply:'once'|'always'|'reject'|'unknown';decision:'allow'|'deny'|'unknown';patterns:string[];command?:string}
  error?:HostAssistantError
  assistant?:HostAssistantResult
}
export interface HostAssistantError{name?:string;message:string;isRetryable?:boolean;statusCode?:number}
export interface HostAssistantActivity{message_id?:string;observed_at:number;output_tokens:number;reasoning_tokens:number;tool_calls:number;text_chars:number}
export interface HostAssistantResult{text:string;structured?:unknown;model?:{model?:string;variant?:string;message_id?:string;parent_id?:string;created_at?:number};usage?:HostUsageObservation;activity?:HostAssistantActivity;incomplete_turn?:{message_id?:string;parent_id?:string;created_at:number;empty:boolean};error?:HostAssistantError}
export interface HostCapabilityView{
  childSessions:boolean;asyncPrompt:boolean;syncPrompt:boolean;abort:boolean;providerInventory:boolean;appLog:boolean
  sessionStatus:boolean;childSessionList:boolean;sessionTodo:boolean;sessionDiff:boolean;sessionFork:boolean;sessionSummarize:boolean;sessionRevert:boolean;sessionUnrevert:boolean
  workerRuntime:boolean;degraded:string[];contracts:HostCapabilityContract[]
}
export interface HostNativeSessionPort{diff(sessionID:string):Promise<unknown>;revert(sessionID:string,messageID?:string):Promise<unknown>}
export interface HostPort{
  capabilities:HostCapabilityView
  nativeSession:HostNativeSessionPort
  log(level:HostLogLevel,message:string,extra?:Record<string,unknown>):Promise<void>
  refreshRuntimeInventory(reason:string):Promise<number>
  getModels():AvailableModel[]
  readAssistantResult(sessionID:string):Promise<HostAssistantResult>
  sessionStatus(sessionID:string):Promise<HostChildSessionStatus>
  continueSession(sessionID:string,text:string,metadata:Record<string,unknown>):Promise<boolean>
}

export interface ChildWorkspaceRequest{workspaceID:string;directory:string}
export interface ChildSessionCreateRequest{parentSessionID:string;title:string;role:string;model?:string;variant?:string;workspace?:ChildWorkspaceRequest;forkFromSession?:string}
export interface ChildSessionCreateResult{child:{id?:string;workspaceID?:string;directory?:string};fork:{requested:boolean;nativeAvailable:boolean;used:false;reason?:string}}
export type HostChildSessionStatus='idle'|'busy'|'retry'|'unknown'
export type HostPromptFormat={type:'text'}|{type:'json_schema';schema:Record<string,unknown>;retryCount?:number}
export interface ChildSessionPort{
  capabilities:{create:boolean;prompt:boolean;abort:boolean;status:boolean;diff:boolean;summarize:boolean;fork:boolean;structuredOutput?:boolean}
  create(request:ChildSessionCreateRequest):Promise<ChildSessionCreateResult>
  prompt(sessionID:string,text:string,role?:string,model?:string,variant?:string,tools?:Record<string,boolean>,messageID?:string,format?:HostPromptFormat):Promise<unknown>
  abort(sessionID:string):Promise<'server'|'server-reconciled'|'client'|'client-reconciled'|'unavailable'>
  status(sessionID:string):Promise<HostChildSessionStatus>
  diff(sessionID:string):Promise<unknown>
  summarize(sessionID:string):Promise<unknown>
}
