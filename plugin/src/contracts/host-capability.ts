export type HostCapabilityStatus = 'SUPPORTED'|'DEGRADED'|'UNSUPPORTED'
export type HostCapabilityVerificationLevel = 'DECLARED'|'OBSERVED'|'CONTROLLED_ACCEPTANCE'|'REAL_HOST_ACCEPTANCE'

export interface OpenCodeCapabilityObservation {
  childSessions:boolean
  asyncPrompt:boolean
  syncPrompt:boolean
  abort:boolean
  providerInventory:boolean
  appLog:boolean
  sessionStatus:boolean
  childSessionList:boolean
  sessionTodo:boolean
  sessionDiff:boolean
  sessionFork:boolean
  sessionSummarize:boolean
  sessionRevert:boolean
  sessionUnrevert:boolean
}

export interface HostCapabilityContract {
  id:string
  host_id:'opencode'
  status:HostCapabilityStatus
  verification_level:HostCapabilityVerificationLevel
  native_primitive?:string
  adapter_entrypoint?:string
  fallback?:string
  semantic_loss:string[]
  required_permissions:string[]
  acceptance_ref:string
  forbidden_fake_behavior:string
}

function supported(id:string,native_primitive:string,adapter_entrypoint:string,acceptance_ref:string):HostCapabilityContract{return{
  id,host_id:'opencode',status:'SUPPORTED',verification_level:'OBSERVED',native_primitive,adapter_entrypoint,semantic_loss:[],required_permissions:[],acceptance_ref,forbidden_fake_behavior:`Do not claim ${id} unless the native primitive is actually observable on the active OpenCode client.`
}}
function degraded(id:string,fallback:string,semantic_loss:string[],acceptance_ref:string,native_primitive?:string,adapter_entrypoint?:string):HostCapabilityContract{return{
  id,host_id:'opencode',status:'DEGRADED',verification_level:'OBSERVED',native_primitive,adapter_entrypoint,fallback,semantic_loss,required_permissions:[],acceptance_ref,forbidden_fake_behavior:`Do not represent ${id} fallback behavior as equivalent to the missing native capability.`
}}
function unsupported(id:string,acceptance_ref:string,forbidden_fake_behavior:string):HostCapabilityContract{return{
  id,host_id:'opencode',status:'UNSUPPORTED',verification_level:'OBSERVED',semantic_loss:[],required_permissions:[],acceptance_ref,forbidden_fake_behavior
}}
function realHostSupported(id:string,native_primitive:string,adapter_entrypoint:string,acceptance_ref:string,required_permissions:string[]=[]):HostCapabilityContract{return{
  id,host_id:'opencode',status:'SUPPORTED',verification_level:'REAL_HOST_ACCEPTANCE',native_primitive,adapter_entrypoint,semantic_loss:[],required_permissions,acceptance_ref,forbidden_fake_behavior:`Do not claim ${id} beyond the exact source/host behavior proven by the real-host acceptance receipt.`
}}

export function openCodeHostCapabilityContracts(o:OpenCodeCapabilityObservation):HostCapabilityContract[]{
  const prompt=o.asyncPrompt?supported('session-prompt','session.promptAsync','NativeOpenCodeAdapter.prompt','main-prompt-hardening.test.mjs'):
    o.syncPrompt?degraded('session-prompt','session.prompt synchronous fallback',['native async prompt primitive is unavailable'],'main-prompt-hardening.test.mjs','session.prompt','NativeOpenCodeAdapter.prompt'):
    unsupported('session-prompt','main-prompt-delegation-preconditions.test.mjs','Do not dispatch a worker when neither native async nor synchronous session prompt execution exists.')
  const worker=o.childSessions&&(o.asyncPrompt||o.syncPrompt)&&o.abort?supported('worker-runtime','session.create + session.prompt + session.abort','TaskRuntime','stage2-role-contract.test.mjs'):
    unsupported('worker-runtime','main-prompt-delegation-preconditions.test.mjs','Do not advertise or expose Hi worker execution without create, prompt, and abort ownership primitives.')
  return [
    o.childSessions?supported('child-session-create','session.create','NativeOpenCodeAdapter/client-adapter','stage2-role-contract.test.mjs'):unsupported('child-session-create','main-prompt-delegation-preconditions.test.mjs','Do not synthesize a child worker when OpenCode cannot create a child session.'),
    prompt,
    o.abort?supported('session-abort','session.abort','client-adapter.abortSession','provider-fallback-hardening.test.mjs'):unsupported('session-abort','provider-fallback-hardening.test.mjs','Do not open a replacement child while the previous execution owner cannot be terminated or reconciled.'),
    o.providerInventory?supported('provider-inventory','provider.list/config.providers','plugin.providerModels','provider-connected-inventory.test.mjs'):degraded('provider-inventory','host-default compatibility delegation',['adaptive inventory-aware model routing is unavailable'],'external-provider-inventory-nonblocking.test.mjs'),
    o.appLog?supported('structured-log','app.log','plugin.log','native-first.test.mjs'):degraded('structured-log','bounded local runtime state/doctor only',['host structured diagnostic log is unavailable'],'doctor-deepening.test.mjs'),
    o.sessionStatus?supported('session-status','session.status','NativeOpenCodeAdapter.status','forensic-hardening.test.mjs'):degraded('session-status','event/runtime-owned state reconciliation',['host session status cannot be independently observed'],'forensic-hardening.test.mjs'),
    o.childSessionList?supported('child-session-list','session.children','NativeOpenCodeAdapter.children','forensic-hardening.test.mjs'):degraded('child-session-list','Hi-owned worker registry',['foreign/native child sessions cannot be exhaustively enumerated'],'external-child-mission-isolation.test.mjs'),
    o.sessionTodo?supported('session-todo','session.todo','NativeOpenCodeAdapter.todo','forensic-hardening.test.mjs'):degraded('session-todo','Hi mission/task state',['native todo parity is unavailable'],'doctor-lifecycle-ownership.test.mjs'),
    o.sessionDiff?supported('session-diff','session.diff','NativeOpenCodeAdapter.diff','native-diff-ownership.test.mjs'):degraded('session-diff','file events + WorkerResult changed_files',['native diff reconciliation and exact write attribution are weaker'],'native-diff-ownership.test.mjs'),
    o.sessionFork?supported('session-fork','session.fork','NativeOpenCodeAdapter.fork','native-first.test.mjs'):degraded('session-fork','fresh child session creation',['session context is not inherited by a native fork'],'context-survival-hardening.test.mjs'),
    o.sessionSummarize?supported('session-summarize','session.summarize','NativeOpenCodeAdapter.summarize','context-survival-hardening.test.mjs'):degraded('session-summarize','ContextGovernor bounded local compaction',['host-native session summary is unavailable'],'context-survival-hardening.test.mjs'),
    o.sessionRevert?supported('session-revert','session.revert','NativeOpenCodeAdapter.revert','forensic-hardening.test.mjs'):degraded('session-revert','exact rollback command only for native-coverage gaps',['native session-aware revert and evidence invalidation coupling are unavailable'],'forensic-hardening.test.mjs'),
    o.sessionUnrevert?supported('session-unrevert','session.unrevert','NativeOpenCodeAdapter.unrevert','forensic-hardening.test.mjs'):unsupported('session-unrevert','forensic-hardening.test.mjs','Do not claim reversible native unrevert when the host primitive is absent.'),
    worker,
    unsupported('browser-execution','methodology-host-capability.test.mjs','Do not claim browser/visual execution from MCP naming, prompts, screenshots, or tool inventory alone; the audited OpenCode host surface exposes MCP/tool discovery but Hi has no deterministic browser executor/evidence adapter.'),
    realHostSupported('process-lifecycle','OpenCode v2 PTY create/get/list/remove/connect-token + ticketed WebSocket','ProcessRuntime + OpenCodePtyAdapter','p3-process-runtime-lifecycle.test.mjs',['OpenCode role bash permission','external_directory when cwd is outside the project','Hi ExternalAction/Authority for classified external effects']),
    unsupported('workspace-isolation-binding','main-prompt-coexistence-platform-batch.test.mjs','The audited OpenCode host surface exposes workspace/session workspaceID primitives and W1 defines Hi IsolationDecision/WorkspaceLease contracts, but no W2 provisioning/binding adapter or W3 real-host child-execution proof exists; do not claim isolation from contract/worktree existence alone.')
  ]
}

export function hostCapabilityByID(items:readonly HostCapabilityContract[],id:string):HostCapabilityContract|undefined{return items.find(x=>x.id===id)}
