function supported(id, native_primitive, adapter_entrypoint, acceptance_ref) {
    return {
        id, host_id: 'opencode', status: 'SUPPORTED', verification_level: 'OBSERVED', native_primitive, adapter_entrypoint, semantic_loss: [], required_permissions: [], acceptance_ref, forbidden_fake_behavior: `Do not claim ${id} unless the native primitive is actually observable on the active OpenCode client.`
    };
}
function degraded(id, fallback, semantic_loss, acceptance_ref, native_primitive, adapter_entrypoint) {
    return {
        id, host_id: 'opencode', status: 'DEGRADED', verification_level: 'OBSERVED', native_primitive, adapter_entrypoint, fallback, semantic_loss, required_permissions: [], acceptance_ref, forbidden_fake_behavior: `Do not represent ${id} fallback behavior as equivalent to the missing native capability.`
    };
}
function unsupported(id, acceptance_ref, forbidden_fake_behavior) {
    return {
        id, host_id: 'opencode', status: 'UNSUPPORTED', verification_level: 'OBSERVED', semantic_loss: [], required_permissions: [], acceptance_ref, forbidden_fake_behavior
    };
}
function observedOwned(id, available, native_primitive, adapter_entrypoint, acceptance_ref, required_permissions = [], runtime_health_required = false) {
    return {
        id, host_id: 'opencode', status: available ? 'SUPPORTED' : 'UNSUPPORTED', verification_level: 'OBSERVED', native_primitive, adapter_entrypoint, ...(available ? { semantic_loss: [] } : { semantic_loss: ['active host primitive/runtime health was not observed'] }), required_permissions, ...(runtime_health_required ? { runtime_health_required: true } : {}), acceptance_ref, forbidden_fake_behavior: `Do not claim ${id} from adapter presence, a mock client, or a unit test. Runtime support requires an active-host observation; T3/REAL_HOST_ACCEPTANCE belongs only to the exact external acceptance receipt/projection.`
    };
}
export function openCodeHostCapabilityContracts(o, owned = {}) {
    const prompt = o.asyncPrompt ? supported('session-prompt', 'session.promptAsync', 'NativeOpenCodeAdapter.prompt', 'hardening.test.mjs') :
        o.syncPrompt ? degraded('session-prompt', 'session.prompt synchronous fallback', ['native async prompt primitive is unavailable'], 'hardening.test.mjs', 'session.prompt', 'NativeOpenCodeAdapter.prompt') :
            unsupported('session-prompt', 'delegation-preconditions.test.mjs', 'Do not dispatch a worker when neither native async nor synchronous session prompt execution exists.');
    const worker = o.childSessions && (o.asyncPrompt || o.syncPrompt) && o.abort ? supported('worker-runtime', 'session.create + session.prompt + session.abort', 'TaskRuntime', 'role-contract.test.mjs') :
        unsupported('worker-runtime', 'delegation-preconditions.test.mjs', 'Do not advertise or expose Hi worker execution without create, prompt, and abort ownership primitives.');
    return [
        o.childSessions ? supported('child-session-create', 'session.create', 'NativeOpenCodeAdapter/client-adapter', 'role-contract.test.mjs') : unsupported('child-session-create', 'delegation-preconditions.test.mjs', 'Do not synthesize a child worker when OpenCode cannot create a child session.'),
        prompt,
        o.abort ? supported('session-abort', 'session.abort', 'client-adapter.abortSession', 'provider-fallback-hardening.test.mjs') : unsupported('session-abort', 'provider-fallback-hardening.test.mjs', 'Do not open a replacement child while the previous execution owner cannot be terminated or reconciled.'),
        o.providerInventory ? supported('provider-inventory', 'provider.list/config.providers', 'plugin.providerModels', 'provider-connected-inventory.test.mjs') : degraded('provider-inventory', 'host-default compatibility delegation', ['adaptive inventory-aware model routing is unavailable'], 'external-provider-inventory-nonblocking.test.mjs'),
        o.appLog ? supported('structured-log', 'app.log', 'plugin.log', 'native-first.test.mjs') : degraded('structured-log', 'bounded local runtime state/doctor only', ['host structured diagnostic log is unavailable'], 'doctor-deepening.test.mjs'),
        o.sessionStatus ? supported('session-status', 'session.status', 'NativeOpenCodeAdapter.status', 'forensic-hardening.test.mjs') : degraded('session-status', 'event/runtime-owned state reconciliation', ['host session status cannot be independently observed'], 'forensic-hardening.test.mjs'),
        o.childSessionList ? supported('child-session-list', 'session.children', 'NativeOpenCodeAdapter.children', 'forensic-hardening.test.mjs') : degraded('child-session-list', 'Hi-owned worker registry', ['foreign/native child sessions cannot be exhaustively enumerated'], 'external-child-mission-isolation.test.mjs'),
        o.sessionTodo ? supported('session-todo', 'session.todo', 'NativeOpenCodeAdapter.todo', 'forensic-hardening.test.mjs') : degraded('session-todo', 'Hi mission/task state', ['native todo parity is unavailable'], 'doctor-lifecycle-ownership.test.mjs'),
        o.sessionDiff ? supported('session-diff', 'session.diff', 'NativeOpenCodeAdapter.diff', 'native-diff-ownership.test.mjs') : degraded('session-diff', 'file events + WorkerResult changed_files', ['native diff reconciliation and exact write attribution are weaker'], 'native-diff-ownership.test.mjs'),
        o.sessionFork ? supported('session-fork', 'session.fork', 'NativeOpenCodeAdapter.fork', 'native-first.test.mjs') : degraded('session-fork', 'fresh child session creation', ['session context is not inherited by a native fork'], 'context-survival-hardening.test.mjs'),
        o.sessionSummarize ? supported('session-summarize', 'session.summarize', 'NativeOpenCodeAdapter.summarize', 'context-survival-hardening.test.mjs') : degraded('session-summarize', 'bounded Hi mission-survival/context projection', ['host-native session summary is unavailable'], 'context-survival-hardening.test.mjs'),
        o.sessionRevert ? supported('session-revert', 'session.revert', 'NativeOpenCodeAdapter.revert', 'forensic-hardening.test.mjs') : degraded('session-revert', 'exact rollback command only for native-coverage gaps', ['native session-aware revert and evidence invalidation coupling are unavailable'], 'forensic-hardening.test.mjs'),
        o.sessionUnrevert ? supported('session-unrevert', 'session.unrevert', 'NativeOpenCodeAdapter.unrevert', 'forensic-hardening.test.mjs') : unsupported('session-unrevert', 'forensic-hardening.test.mjs', 'Do not claim reversible native unrevert when the host primitive is absent.'),
        worker,
        unsupported('structured-human-decision-transport', 'structured-human-decision-host.test.mjs', 'Do not claim a structured HumanDecision transport from question events, question list/reply/reject APIs, or the model-facing question tool. Hi requires a direct host/plugin open primitive that can bind the exact canonical decision ID without model mediation.'),
        observedOwned('browser-execution', owned.browserExecution === true, 'BrowserExecutor adapter discovered healthy at the OpenCode boundary', 'BrowserExecutor port + OpenCode adapter + Hi browser ownership/evidence tool surface', 'data/validation/compatibility-matrix-0.1.0.json', [], true),
        observedOwned('process-lifecycle', owned.processLifecycle === true, 'OpenCode v2 PTY create/get/list/remove/connect-token + ticketed WebSocket', 'ProcessRuntime + OpenCodePtyAdapter', 'data/validation/compatibility-matrix-0.1.0.json', ['OpenCode role bash permission', 'external_directory when cwd is outside the project', 'Hi ExternalAction/Authority for classified external effects'], true),
        observedOwned('workspace-isolation-binding', owned.workspaceIsolation === true, 'experimental.workspace create/list/remove + v2 session.create workspace/workspaceID routing', 'WorkspaceRuntime + OpenCodeWorkspaceAdapter + ChildExecutionCoordinator', 'data/validation/compatibility-matrix-0.1.0.json', ['OpenCode child role edit/write permission; isolation never widens external_directory authority'], true)
    ];
}
export function hostCapabilityByID(items, id) { return items.find(x => x.id === id); }
