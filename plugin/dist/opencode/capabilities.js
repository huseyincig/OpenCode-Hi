import { NativeOpenCodeAdapter } from './native-adapter.js';
import { openCodeHostCapabilityContracts } from '../contracts/host-capability.js';
export function detectOpenCodeCapabilities(client, owned = {}) {
    const n = new NativeOpenCodeAdapter(client);
    const childSessions = n.has('session-create');
    const asyncPrompt = n.has('prompt-async');
    const syncPrompt = n.has('prompt-sync');
    const abort = n.has('abort');
    const providerInventory = n.has('provider-inventory');
    const appLog = n.has('structured-log');
    const sessionStatus = n.has('status');
    const childSessionList = n.has('children');
    const sessionTodo = n.has('todo');
    const sessionDiff = n.has('diff');
    const sessionFork = n.has('fork');
    // Method presence alone is insufficient: current summarize requires explicit provider/model identity.
    const sessionSummarize = false;
    const sessionRevert = n.has('revert');
    const sessionUnrevert = n.has('unrevert');
    const degraded = [];
    if (!childSessions)
        degraded.push('child-session-create-unavailable');
    if (!asyncPrompt && !syncPrompt)
        degraded.push('session-prompt-unavailable');
    if (!abort)
        degraded.push('session-abort-unavailable');
    if (!providerInventory)
        degraded.push('provider-inventory-unavailable');
    if (!sessionStatus)
        degraded.push('session-status-unavailable');
    if (!sessionDiff)
        degraded.push('session-diff-unavailable');
    if (!sessionRevert)
        degraded.push('session-revert-unavailable');
    const contracts = openCodeHostCapabilityContracts({ childSessions, asyncPrompt, syncPrompt, abort, providerInventory, appLog, sessionStatus, childSessionList, sessionTodo, sessionDiff, sessionFork, sessionSummarize, sessionRevert, sessionUnrevert }, owned);
    return { childSessions, asyncPrompt, syncPrompt, abort, providerInventory, appLog, sessionStatus, childSessionList, sessionTodo, sessionDiff, sessionFork, sessionSummarize, sessionRevert, sessionUnrevert, workerRuntime: childSessions && (asyncPrompt || syncPrompt) && abort, degraded, contracts };
}
export function createOwnedCapabilityObserver(client, contracts, processProbe, workspaceProbe) {
    let processLifecycle = false, workspaceIsolation = false, browserExecution = false;
    const refresh = () => { const observed = detectOpenCodeCapabilities(client, { processLifecycle, workspaceIsolation, browserExecution }); contracts.splice(0, contracts.length, ...observed.contracts); };
    const observe = async (id) => { const health = await (id === 'process-lifecycle' ? processProbe : workspaceProbe).health(); if (id === 'process-lifecycle')
        processLifecycle = health.available;
    else
        workspaceIsolation = health.available; refresh(); return health; };
    const setBrowserAvailable = (available) => { browserExecution = available; refresh(); };
    refresh();
    return { observe, setBrowserAvailable };
}
