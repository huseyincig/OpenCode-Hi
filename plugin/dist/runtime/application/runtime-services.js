import { MissionStore } from '../mission/mission-store.js';
import { BackgroundRegistry } from '../background/registry.js';
import { RuntimePersistence } from '../state/persistence.js';
import { ConcurrencyScheduler } from '../scheduler/concurrency.js';
import { TaskRuntime } from '../task/task-runtime.js';
import { appendLedger } from '../ledger/ledger.js';
import { createRuntimeScopedStores } from './runtime-scoped-stores.js';
import { ProcessRuntime } from '../process/runtime.js';
import { WorkspaceRuntime } from '../workspace/runtime.js';
import { ChatHumanDecisionTransport } from '../human-decision/transport.js';
export function createRuntimeServices(input) {
    const { ports, projectRoot, packageRoot, getConfig, getModels, getHostConfig } = input;
    const store = new MissionStore(projectRoot, ports.nativeContext, () => getConfig().primaryMode, () => ({ mode: getConfig().execution.topology, maxAgents: getConfig().execution.maxAgents, parallelism: getConfig().execution.parallelism }));
    const background = new BackgroundRegistry();
    const humanDecisionTransport = new ChatHumanDecisionTransport();
    const scopedStores = createRuntimeScopedStores(projectRoot, packageRoot);
    const persistence = new RuntimePersistence(projectRoot);
    const restored = persistence.load();
    if (persistence.lastLoadReport.error)
        throw new Error(`OpenCode-Hi runtime state is invalid and was not discarded: ${persistence.lastLoadReport.error}. Reconcile or remove the invalid runtime-state file explicitly before restarting Hi.`);
    store.restore(restored, persistence.lastLoadReport.uncleanShutdown === true);
    for (const m of store.all())
        for (const w of m.execution.workers)
            if (!['completed', 'failed', 'cancelled'].includes(w.status))
                background.set(w);
    persistence.markRunning(store.all());
    const scheduler = new ConcurrencyScheduler(() => ({ global: getConfig().parallel.enabled ? getConfig().parallel.max : 1, providers: getConfig().parallel.providers, models: getConfig().parallel.models }));
    const eventSink = ev => { const m = store.all().find(x => x.identity.mission_id === ev.mission_id); if (m)
        appendLedger(m, `event.${ev.type}`, { task_id: ev.task_id, worker_id: ev.worker_id, payload: ev.payload }); };
    const browserExecutor = ports.createBrowser((bytes, c) => { const a = scopedStores.contextArtifacts.addBinary('browser-screenshot', `Browser screenshot for ${c.task_id}`, bytes, { extension: 'png', mediaType: 'image/png', producer: 'hi-browser-executor', consumerRefs: [`task:${c.task_id}`] }); return `hi-artifact:${a.artifact_id}`; });
    let browserAvailable = false;
    const setBrowserAvailable = (value) => { browserAvailable = value; };
    const workspaceRuntime = new WorkspaceRuntime(ports.workspace, projectRoot);
    const tasks = new TaskRuntime(ports.childSession, background, scheduler, projectRoot, packageRoot, getConfig, getModels, getHostConfig, eventSink, ports.hostCapabilities, scopedStores, workspaceRuntime, () => browserAvailable ? new Set(['host-capability:browser-execution']) : new Set(), browserExecutor);
    for (const m of store.all())
        for (const w of m.execution.workers)
            if (w.session_id && w.status === 'ready')
                background.set(w);
    const processRuntime = new ProcessRuntime(ports.process, projectRoot, getHostConfig);
    return { store, background, humanDecisionTransport, persistence, scheduler, eventSink, tasks, processExecutor: ports.process, processRuntime, workspaceExecutor: ports.workspace, workspaceRuntime, browserExecutor, setBrowserAvailable, scopedStores };
}
