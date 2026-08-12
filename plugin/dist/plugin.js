import { resolveHiConfigWithReport } from './config/resolver.js';
import { DEFAULT_HI_CONFIG } from './config/defaults.js';
import { runDoctor, formatDoctor } from './doctor/checks.js';
import { createChatMessageHook } from './hooks/chat-message.js';
import { createSystemTransformHook } from './hooks/system-transform.js';
import { createMessagesTransformHook } from './hooks/messages-transform.js';
import { createToolBeforeHook } from './hooks/tool-before.js';
import { createToolAfterHook } from './hooks/tool-after.js';
import { MissionStore } from './runtime/mission/mission-store.js';
import { BackgroundRegistry } from './runtime/background/registry.js';
import { TaskRuntime } from './runtime/task/task-runtime.js';
import { evaluateIdle, shouldCountStagnation } from './runtime/continuation/evaluator.js';
import { dispatchContinuation } from './runtime/continuation/dispatcher.js';
import { lastAssistantText, lastAssistantModel, listMessages, listProviders } from './opencode/client-adapter.js';
import { NativeOpenCodeAdapter } from './opencode/native-adapter.js';
import { normalizeOpenCodeEvent, eventFilePaths, permissionDecision, permissionEventID, permissionPatterns, permissionReply } from './opencode/event-adapter.js';
import { ExperimentalOpenCodeAdapter } from './opencode/experimental-adapter.js';
import { parseWorkerResult } from './runtime/task/result-parser.js';
import { evaluateCompletion } from './runtime/completion/evaluator.js';
import { appendLedger } from './runtime/ledger/ledger.js';
import { ConcurrencyScheduler } from './runtime/scheduler/concurrency.js';
import { TeamRuntime } from './runtime/team/team-runtime.js';
import { RuntimePersistence } from './runtime/state/persistence.js';
import { compactLedgerReport } from './runtime/ledger/report.js';
import { aggregateMissionMetrics } from './runtime/ledger/metrics.js';
import { formatUserMissionStatus } from './runtime/ledger/status.js';
import { detectOpenCodeCapabilities } from './opencode/capabilities.js';
import { runtimeSignal } from './runtime/events/event-sink.js';
import { evaluatePreconditions, TaskPreconditionError } from './runtime/readiness/preconditions.js';
import { registerTemporaryMutation, resolveRollback } from './runtime/mutations/temporary-mutations.js';
import { createHash } from 'node:crypto';
import { addEvidence, markMutation } from './runtime/evidence/evidence-runtime.js';
import { assertHiToolNamespace } from './opencode/tool-namespace.js';
import { acquireHiRuntimeInstance } from './opencode/instance-guard.js';
import { nativeTool as tool } from './opencode/plugin-tool.js';
import { PACKAGED_HI_AGENTS } from './generated/agent-config.js';
import { existsSync } from 'node:fs';
import { ProjectAuthorityStore, applyProjectAuthorityPermissions, authorityClassForPatterns } from './runtime/safety/project-authority.js';
import { dirname, resolve } from 'node:path';
import { resolveNativeProjectRoot } from './runtime/intent/repo-context.js';
import { fileURLToPath } from 'node:url';
function providerModels(raw) {
    const root = raw?.all ?? raw?.providers ?? raw ?? [];
    const providers = Array.isArray(root) ? root : Object.values(root ?? {});
    const connectedRaw = Array.isArray(raw?.connected) ? raw.connected : undefined;
    const connected = connectedRaw ? new Set(connectedRaw.map((x) => typeof x === 'string' ? x : String(x?.id ?? x?.providerID ?? x?.name ?? '')).filter(Boolean)) : undefined;
    const out = [];
    for (const p of providers) {
        const pid = p?.id ?? p?.providerID ?? p?.name;
        const provider = pid ? String(pid) : undefined;
        if (connected && provider && !connected.has(provider))
            continue;
        const models = p?.models ?? p?.model ?? [];
        const list = Array.isArray(models) ? models : Object.values(models ?? {});
        for (const model of list) {
            const id = model?.id ?? model?.modelID ?? model?.name;
            if (!id)
                continue;
            const rawID = String(id);
            const canonical = provider && !rawID.startsWith(`${provider}/`) ? `${provider}/${rawID}` : rawID;
            const variantsRaw = model?.variants ?? model?.variant;
            const variants = Array.isArray(variantsRaw) ? variantsRaw.map(String) : (variantsRaw && typeof variantsRaw === 'object' ? Object.keys(variantsRaw) : []);
            out.push({ id: canonical, provider, cost: Number(model?.cost?.input ?? model?.cost ?? 0) || 0, quality: Number(model?.quality ?? 0) || 0, writeCapable: model?.write !== false, tags: Array.isArray(model?.tags) ? model.tags.map(String) : [], variants });
        }
    }
    return out;
}
export const HiPlugin = async (ctx) => {
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const packagedSkillsDir = resolve(packageRoot, 'skills');
    const projectRoot = resolveNativeProjectRoot(process.cwd(), { project: ctx.project, directory: ctx.directory, worktree: ctx.worktree });
    const agentCollisions = [];
    const projectAuthority = new ProjectAuthorityStore(projectRoot);
    const pendingNativePermissions = new Map();
    let config = DEFAULT_HI_CONFIG;
    let configResolution;
    let hostConfig = {};
    const capabilities = detectOpenCodeCapabilities(ctx.client);
    const native = new NativeOpenCodeAdapter(ctx.client);
    const store = new MissionStore(projectRoot, { project: ctx.project, directory: ctx.directory, worktree: ctx.worktree }, () => config.primaryMode, () => ({ mode: config.execution.topology, maxAgents: config.execution.maxAgents, parallelism: config.execution.parallelism, allowMultiRoleAgent: config.execution.allowMultiRoleAgent }));
    const background = new BackgroundRegistry();
    const persistence = new RuntimePersistence(projectRoot);
    const restored = persistence.load();
    store.restore(restored, persistence.lastLoadReport.uncleanShutdown === true);
    for (const m of store.all())
        for (const w of m.workers)
            if (!['completed', 'failed', 'cancelled'].includes(w.status))
                background.set(w);
    persistence.markRunning(store.all());
    const scheduler = new ConcurrencyScheduler(() => ({ global: config.parallel.enabled ? config.parallel.max : 1, providers: config.parallel.providers, models: config.parallel.models }));
    let models = [];
    let openCodeVersion;
    const log = async (level, message, extra) => { try {
        await ctx.client?.app?.log?.({ body: { service: 'hi', level, message, extra } });
    }
    catch { } };
    let inventoryRefresh;
    const refreshRuntimeInventory = async (reason) => {
        if (inventoryRefresh)
            return inventoryRefresh;
        inventoryRefresh = (async () => { try {
            const raw = await listProviders(ctx.client);
            const next = providerModels(raw);
            if (next.length)
                models = next;
            await log('info', 'Hi runtime inventory refreshed', { reason, models: models.length, routing_policy: config.routing.modelPolicy });
            return models.length;
        }
        catch (error) {
            await log('warn', 'Hi runtime inventory refresh failed', { reason, error: String(error) });
            return models.length;
        }
        finally {
            inventoryRefresh = undefined;
        } })();
        return inventoryRefresh;
    };
    // Do not await host provider/version APIs during plugin initialization: those APIs may depend on the same config/plugin instance currently loading.
    // Inventory/version are refreshed lazily from config/installation events after hooks are registered.
    const eventSink = ev => { const m = store.all().find(x => x.mission_id === ev.mission_id); if (m)
        appendLedger(m, `event.${ev.type}`, { task_id: ev.task_id, worker_id: ev.worker_id, payload: ev.payload }); };
    const tasks = new TaskRuntime(ctx.client, background, scheduler, projectRoot, packageRoot, () => config, () => models, () => hostConfig, eventSink);
    for (const m of store.all())
        for (const w of m.workers)
            if (w.session_id && w.status === 'ready')
                background.set(w);
    const experimental = new ExperimentalOpenCodeAdapter(store, background);
    const teams = new TeamRuntime(tasks, () => config.teamMode.enabled, () => ({ maxMembers: config.teamMode.maxMembers, maxMessages: config.teamMode.maxMessages, maxWallMs: config.teamMode.maxWallMinutes * 60 * 1000, maxTurns: config.teamMode.maxTurns }));
    void log('info', 'OpenCode-Hi plugin initialized', { directory: ctx.directory, models: models.length, restored: store.all().length, uncleanShutdown: persistence.lastLoadReport.uncleanShutdown === true, capabilities });
    const doctorTool = tool({ description: 'Run OpenCode-Hi runtime/configuration health checks', args: {}, execute: async () => formatDoctor(runDoctor(config, store, projectRoot, { models, resolution: configResolution, capabilities, hostConfig, openCodeVersion })) });
    const statusTool = tool({ description: 'Show compact user-facing Hi mission status. This intentionally excludes diagnostic logs and ledger payloads.', args: {}, execute: async (_args, c) => { const m = store.get(c?.sessionID); return m ? formatUserMissionStatus(m) : 'Hi: no active mission'; } });
    const metricsTool = tool({ description: 'Show aggregate Hi runtime metrics derived from bounded mission state. Token/cost telemetry is omitted unless the host provides it.', args: {}, execute: async () => JSON.stringify(aggregateMissionMetrics(store.all())) });
    const ledgerTool = tool({ description: 'Show a bounded Hi execution ledger/report on demand.', args: { limit: tool.schema.number().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); return m ? JSON.stringify(compactLedgerReport(m, a?.limit ?? 40)) : 'No active Hi mission'; } });
    const readinessTool = tool({ description: 'Show machine-readable Hi mission readiness/preconditions and gates.', args: {}, execute: async (_a, c) => { const m = store.get(c?.sessionID); return m ? JSON.stringify(evaluatePreconditions(m)) : 'No active Hi mission'; } });
    const artifactAddTool = tool({ description: 'Attach one bounded context artifact reference to the current Hi mission.', args: { kind: tool.schema.string(), title: tool.schema.string().optional(), uri: tool.schema.string().optional(), summary: tool.schema.string().optional(), sha256: tool.schema.string().optional(), approved: tool.schema.boolean().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; const raw = String(a.uri ?? a.summary ?? a.title ?? a.kind), item = { id: `ca_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, kind: String(a.kind).slice(0, 80), title: a.title ? String(a.title).slice(0, 300) : undefined, uri: a.uri ? String(a.uri).slice(0, 1200) : undefined, summary: a.summary ? String(a.summary).slice(0, 2000) : undefined, sha256: a.sha256 ? String(a.sha256) : createHash('sha256').update(raw).digest('hex'), approved: Boolean(a.approved), added_at: Date.now() }; m.context_artifacts.push(item); if (m.context_artifacts.length > 8)
            m.context_artifacts.splice(0, m.context_artifacts.length - 8); appendLedger(m, 'context-artifact.added', { payload: { id: item.id, kind: item.kind, sha256: item.sha256 } }); return JSON.stringify(item); } });
    const artifactsTool = tool({ description: 'List bounded Hi context artifact references.', args: {}, execute: async (_a, c) => { const m = store.get(c?.sessionID); return m ? JSON.stringify(m.context_artifacts) : 'No active Hi mission'; } });
    const mutationTool = tool({ description: 'Register a temporary execution mutation. Prefer native session revert for project-local tracked experiments; use an exact rollback command only for native-coverage gaps.', args: { kind: tool.schema.string(), description: tool.schema.string(), rollback_command: tool.schema.string().optional(), native_revert: tool.schema.boolean().optional(), session_id: tool.schema.string().optional(), message_id: tool.schema.string().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; const mode = a.native_revert ? 'native-revert' : 'command'; if (mode === 'native-revert' && !capabilities.sessionRevert)
            return 'BLOCKED: OpenCode native session revert is unavailable'; return JSON.stringify(registerTemporaryMutation(m, { kind: String(a.kind), description: String(a.description), rollback_command: a.rollback_command ? String(a.rollback_command) : undefined, rollback_mode: mode, session_id: a.session_id ? String(a.session_id) : c?.sessionID, message_id: a.message_id ? String(a.message_id) : undefined })); } });
    const nativeRollbackTool = tool({ description: 'Resolve a registered native-revert temporary mutation through OpenCode session.revert. Evidence remains stale until reverified.', args: { id: tool.schema.string() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; const item = m.temporary_mutations.find(x => x.id === String(a.id)); if (!item)
            return 'Unknown temporary mutation'; if (item.rollback_mode !== 'native-revert')
            return 'BLOCKED: mutation uses command rollback'; const target = item.session_id ?? m.session_id; const belongs = target === m.session_id || m.workers.some(w => w.session_id === target); if (!belongs)
            return 'BLOCKED: target session is outside this mission'; try {
            await native.revert(target, item.message_id);
            resolveRollback(m, item, true, 'native session revert completed; verification must be refreshed');
            markMutation(m, m.changed_files, 'native-session-revert');
            return JSON.stringify({ status: 'ROLLED_BACK', id: item.id, session_id: target, evidence_fresh: false });
        }
        catch (error) {
            resolveRollback(m, item, false, String(error));
            return `Native revert failed: ${String(error)}`;
        } } });
    const directProgressTool = tool({ description: 'Record parent/Working-Manager direct implementation progress after an observed local mutation. Does not bypass verification or review gates.', args: { summary: tool.schema.string(), obligation_id: tool.schema.string().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; if (!m.changed_files.length && !m.evidence.last_mutation_at)
            return 'BLOCKED: no observed mutation for direct progress'; const open = m.obligations.filter(x => x.kind === 'implementation' && x.status === 'open'), o = a.obligation_id ? open.find(x => x.id === String(a.obligation_id)) : open.length === 1 ? open[0] : undefined; if (!o)
            return open.length > 1 ? 'BLOCKED: multiple implementation obligations are open; specify obligation_id' : 'No open implementation obligation'; o.status = 'closed'; o.closedAt = Date.now(); appendLedger(m, 'implementation.direct-progress', { payload: { summary: String(a.summary).slice(0, 500), obligation: o.id, changed_files: m.changed_files.slice(-30) } }); return JSON.stringify({ status: 'RECORDED', verification_required: !evaluateCompletion(m).complete, changed_files: m.changed_files.slice(-30) }); } });
    const startTool = tool({ description: 'Start one bounded Hi worker task. Use only when delegation is actually beneficial.', args: { objective: tool.schema.string().optional(), role: tool.schema.string().optional(), category: tool.schema.string().optional(), model: tool.schema.string().optional(), model_variant: tool.schema.string().optional(), scope: tool.schema.string().optional(), constraints: tool.schema.string().optional(), dependencies: tool.schema.string().optional(), required_evidence: tool.schema.string().optional(), obligation_ids: tool.schema.string().optional(), fork_from_session: tool.schema.string().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; try {
            const input = { ...a, forkFromSession: a.fork_from_session ? String(a.fork_from_session) : undefined, modelVariant: a.model_variant ? String(a.model_variant) : undefined, scope: a.scope ? String(a.scope).split(',').map((x) => x.trim()).filter(Boolean) : undefined, constraints: a.constraints ? [String(a.constraints)] : undefined, dependencies: a.dependencies ? String(a.dependencies).split(',').map((x) => x.trim()).filter(Boolean) : undefined, requiredEvidence: a.required_evidence ? String(a.required_evidence).split(',').map((x) => x.trim()).filter(Boolean) : undefined, obligationIds: a.obligation_ids ? String(a.obligation_ids).split(',').map((x) => x.trim()).filter(Boolean) : undefined };
            if (m.adaptive_execution?.path === 'DIRECT' && !m.verification_policy.requireReview && ['qa-reviewer', 'security-reviewer'].includes(String(input.role ?? '')))
                return JSON.stringify({ status: 'SKIPPED', reason: 'minimum-sufficient-direct-path: independent reviewer is not required' });
            return JSON.stringify(await tasks.start(m, input));
        }
        catch (e) {
            if (e instanceof TaskPreconditionError) {
                appendLedger(m, 'worker.start.precondition', { payload: { decision: e.result.decision, items: e.result.items.slice(0, 12) } });
                return JSON.stringify({ status: e.result.decision, preconditions: e.result.items });
            }
            appendLedger(m, 'worker.start.failed', { payload: { error: String(e) } });
            return `Task start failed: ${String(e)}`;
        } } });
    const peekTool = tool({ description: 'Inspect one Hi task/worker without polling loops.', args: { id: tool.schema.string() }, execute: async (a, c) => { const m = store.get(c?.sessionID); return m ? JSON.stringify(tasks.peek(m, a.id)) : 'No active Hi mission'; } });
    const listTool = tool({ description: 'List bounded Hi task and worker state.', args: {}, execute: async (_a, c) => { const m = store.get(c?.sessionID); return m ? JSON.stringify(tasks.list(m)) : 'No active Hi mission'; } });
    const awaitTool = tool({ description: 'Check whether an Hi task has reached terminal state. Hi uses event-driven wakeups; do not call repeatedly.', args: { id: tool.schema.string() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; const x = tasks.peek(m, a.id); const status = x?.task?.status ?? x?.worker?.status ?? 'unknown'; return JSON.stringify({ status, terminal: ['completed', 'failed', 'cancelled', 'blocked'].includes(status), result: x?.task?.result }); } });
    const cancelTool = tool({ description: 'Cancel one Hi task/worker.', args: { id: tool.schema.string() }, execute: async (a, c) => { const m = store.get(c?.sessionID); return m ? String(await tasks.cancel(m, a.id)) : 'false'; } });
    const teamCreateTool = tool({ description: 'Create a bounded Hi Team Mode group only for work requiring interacting specialist perspectives.', args: { objective: tool.schema.string(), members: tool.schema.string(), member_models: tool.schema.string().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; if (!config.teamMode.enabled)
            return 'Team Mode disabled'; let memberModels; if (a.member_models && typeof a.member_models === 'string' && a.member_models.trim()) {
            try {
                memberModels = JSON.parse(a.member_models);
                if (typeof memberModels !== 'object' || memberModels === null || Array.isArray(memberModels))
                    throw new Error('member_models must be a JSON object mapping role -> {model, variant}');
            }
            catch (e) {
                return `Invalid member_models JSON: ${e?.message ?? String(e)}`;
            }
        } return JSON.stringify(await teams.create(m, a.objective, String(a.members).split(','), memberModels)); } });
    const teamMessageTool = tool({ description: 'Write one bounded Team Mode mailbox message.', args: { team_id: tool.schema.string(), from: tool.schema.string(), to: tool.schema.string(), text: tool.schema.string(), dedupe_key: tool.schema.string().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); return m ? JSON.stringify(teams.message(m, a.team_id, a.from, a.to, a.text, a.dedupe_key)) : 'No active Hi mission'; } });
    const teamAckTool = tool({ description: 'Acknowledge or release one reserved Team Mode mailbox message.', args: { team_id: tool.schema.string(), member: tool.schema.string(), message_id: tool.schema.string(), processed: tool.schema.boolean().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); return m ? String(teams.messageAck(m, a.team_id, a.member, a.message_id, a.processed !== false)) : 'No active Hi mission'; } });
    const teamStatusTool = tool({ description: 'Show Team Mode state for the current Hi mission.', args: {}, execute: async (_a, c) => { const m = store.get(c?.sessionID); return m ? JSON.stringify(teams.list(m.mission_id)) : 'No active Hi mission'; } });
    const teamInboxTool = tool({ description: 'Read a bounded Team Mode mailbox view for one member or the parent.', args: { team_id: tool.schema.string(), member: tool.schema.string(), since: tool.schema.number().optional(), limit: tool.schema.number().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); return m ? JSON.stringify(teams.inbox(a.team_id, a.member, a.since, a.limit ?? 12)) : 'No active Hi mission'; } });
    const teamMemberAddTool = tool({ description: 'Add one bounded Team Mode member and start its worker.', args: { team_id: tool.schema.string(), role: tool.schema.string(), model: tool.schema.string().optional(), variant: tool.schema.string().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); return m ? JSON.stringify(await teams.addMember(m, a.team_id, a.role, a.model, a.variant)) : 'No active Hi mission'; } });
    const teamMemberRemoveTool = tool({ description: 'Remove one Team Mode member and cancel its worker.', args: { team_id: tool.schema.string(), role: tool.schema.string() }, execute: async (a, c) => { const m = store.get(c?.sessionID); return m ? String(await teams.removeMember(m, a.team_id, a.role)) : 'false'; } });
    const teamBoardTool = tool({ description: 'Create or update one bounded Team Mode task-board item.', args: { team_id: tool.schema.string(), title: tool.schema.string(), item_id: tool.schema.string().optional(), owner: tool.schema.string().optional(), status: tool.schema.string().optional(), evidence: tool.schema.string().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; return JSON.stringify(teams.boardUpsert(m, a.team_id, { id: a.item_id, title: a.title, owner: a.owner, status: ['open', 'in-progress', 'done', 'blocked'].includes(a.status) ? a.status : undefined, evidence: a.evidence ? String(a.evidence).split('|').map((x) => x.trim()).filter(Boolean) : undefined })); } });
    const teamShutdownTool = tool({ description: 'Shutdown one bounded Hi team and cancel its member workers.', args: { team_id: tool.schema.string() }, execute: async (a, c) => { const m = store.get(c?.sessionID); return m ? String(await teams.shutdown(m, a.team_id)) : 'false'; } });
    const onEvent = async ({ event }) => {
        const ev = normalizeOpenCodeEvent(event);
        if (ev.kind === 'installation-updated') {
            await refreshRuntimeInventory('installation-updated');
            return;
        }
        if (ev.rawType === 'server.connected') {
            await refreshRuntimeInventory('server-connected');
            return;
        }
        const sid = ev.sessionID;
        if (!sid)
            return;
        const nativePermissionID = permissionEventID(ev);
        if (ev.kind === 'permission-asked' && nativePermissionID)
            pendingNativePermissions.set(nativePermissionID, permissionPatterns(ev));
        if (ev.kind === 'permission-replied' && nativePermissionID) {
            const patterns = [...new Set([...pendingNativePermissions.get(nativePermissionID) ?? [], ...permissionPatterns(ev)])];
            if (permissionReply(ev) === 'always') {
                const cls = authorityClassForPatterns(patterns);
                if (cls) {
                    projectAuthority.grant(cls);
                    await log('info', 'Hi project authority persisted from native always approval', { authority_class: cls, patterns });
                }
            }
            pendingNativePermissions.delete(nativePermissionID);
        }
        const child = background.list().find(w => w.session_id === sid);
        const childMission = child ? store.get(child.parent_session_id) : undefined;
        const mission = childMission ?? store.get(sid);
        const staleChild = Boolean(child && mission && ((child.parent_mission_id !== undefined && child.parent_mission_id !== mission.mission_id) || (child.generation_at_spawn !== undefined && child.generation_at_spawn !== mission.generation)));
        if (mission) {
            await teams.expireMission(mission);
            await teams.reconcileMission(mission);
            if (child?.status === 'cancelled') {
                appendLedger(mission, 'worker.callback.after-team-shutdown-ignored', { worker_id: child.id, payload: { session_id: sid, event: ev.rawType } });
                persistence.save(store.all());
                return;
            }
        }
        if (child?.restart_reconcile_pending && mission) {
            appendLedger(mission, 'worker.callback.pre-reconcile-ignored', { worker_id: child.id, payload: { session_id: sid, event: ev.rawType, reason: 'runtime-restart-reconcile-pending' } });
            persistence.save(store.all());
            return;
        }
        if (staleChild && mission) {
            appendLedger(mission, 'worker.callback.stale-mission-ignored', { worker_id: child?.id, payload: { worker_mission_id: child?.parent_mission_id, mission_id: mission.mission_id, worker_generation: child?.generation_at_spawn, mission_generation: mission.generation, event: ev.rawType } });
            persistence.save(store.all());
            return;
        }
        if (mission && (mission.user_interrupted || mission.status === 'stopped')) {
            appendLedger(mission, 'runtime.event.after-user-stop-ignored', { worker_id: child?.id, payload: { session_id: sid, event: ev.rawType } });
            persistence.save(store.all());
            return;
        }
        if (ev.kind === 'permission-asked' && mission) {
            const pid = permissionEventID(ev);
            mission.pending_permission_ids ??= [];
            if (!pid || !mission.pending_permission_ids.includes(pid)) {
                if (pid)
                    mission.pending_permission_ids.push(pid);
                mission.pending_permissions = (mission.pending_permissions ?? 0) + 1;
                appendLedger(mission, 'permission.asked', { worker_id: child?.id, payload: { session_id: sid, permission_id: pid } });
            }
            else
                appendLedger(mission, 'permission.duplicate-ignored', { worker_id: child?.id, payload: { session_id: sid, permission_id: pid, event: 'asked' } });
            persistence.save(store.all());
            return;
        }
        if (ev.kind === 'permission-replied' && mission) {
            const pid = permissionEventID(ev);
            mission.pending_permission_ids ??= [];
            const idx = pid ? mission.pending_permission_ids.indexOf(pid) : -1;
            if (pid && idx < 0) {
                appendLedger(mission, 'permission.duplicate-ignored', { worker_id: child?.id, payload: { session_id: sid, permission_id: pid, event: 'replied' } });
            }
            else {
                if (idx >= 0)
                    mission.pending_permission_ids.splice(idx, 1);
                mission.pending_permissions = Math.max(0, (mission.pending_permissions ?? 0) - 1);
                appendLedger(mission, 'permission.replied', { worker_id: child?.id, payload: { session_id: sid, permission_id: pid, decision: permissionDecision(ev) } });
            }
            persistence.save(store.all());
            return;
        }
        if (child) {
            const m = childMission;
            if (!m)
                return;
            if (ev.kind === 'file-edited' || ev.kind === 'file-watcher-updated' || ev.kind === 'session-diff') {
                const files = eventFilePaths(ev);
                const stateHash = ev.kind === 'session-diff' ? createHash('sha256').update(JSON.stringify(ev.properties ?? {})).digest('hex') : undefined;
                if (files.length)
                    await tasks.noteNativeWriteSet(m, child.id, files, ev.rawType, stateHash);
                persistence.save(store.all());
                return;
            }
            if (ev.kind === 'session-status') {
                const nativeStatus = String(ev.properties?.status ?? ev.properties?.state ?? 'unknown');
                tasks.noteNativeStatus(m, child.id, nativeStatus);
                if (child.runtime_recovery_pending && !/idle|completed|stopped/i.test(nativeStatus)) {
                    child.runtime_recovery_pending = false;
                    appendLedger(m, 'worker.runtime-fallback.active', { task_id: child.task_id, worker_id: child.id, payload: { status: nativeStatus, attempt: child.runtime_recovery_attempt ?? 0 } });
                }
                persistence.save(store.all());
                return;
            }
            if (ev.kind === 'lsp-diagnostics') {
                const diagnostics = Array.isArray(ev.properties?.diagnostics) ? ev.properties.diagnostics : [];
                const errors = diagnostics.filter((d) => ['error', 1].includes(d?.severity)).length;
                addEvidence(m, { kind: 'lsp-diagnostics', summary: `native LSP diagnostics: ${errors} error(s), ${diagnostics.length} total`, scope: child.write_set ?? [], source: `session:${sid}:lsp`, pass: errors === 0, outcome: errors === 0 ? 'passed' : 'failed', reason: errors ? `${errors} error diagnostic(s)` : undefined });
                persistence.save(store.all());
                return;
            }
            if (ev.kind === 'session-error' || ev.kind === 'session-deleted') {
                const detail = String(ev.properties?.error?.message ?? ev.properties?.error ?? ev.rawType);
                if (ev.kind === 'session-error' && await tasks.recoverRuntimeFailure(m, child.id, detail)) {
                    store.updateProgress(m);
                    appendLedger(m, 'parent.wake', { worker_id: child.id, payload: { result: 'RUNTIME_FALLBACK', event: ev.rawType } });
                    persistence.save(store.all());
                    return;
                }
                tasks.fail(m, child.id, detail);
                await teams.reconcileMission(m);
                store.updateProgress(m);
                appendLedger(m, 'parent.wake', { worker_id: child.id, payload: { result: 'FAILED', event: ev.rawType } });
                const siblingPending = background.pendingFor(m.session_id).filter(w => w.id !== child.id), permissionFailure = child.last_runtime_failure_kind === 'permission';
                if (permissionFailure) {
                    m.status = 'waiting-user';
                    m.stagnation_count = 0;
                    appendLedger(m, 'user.action.required', { worker_id: child.id, payload: { reason: 'permission-failure', detail } });
                }
                else if (config.executionPolicy === 'adaptive' && !m.user_interrupted && !siblingPending.length)
                    await dispatchContinuation(ctx.client, m, 'Hi child worker failed. Reconcile the failure, preserve completed work, and choose the minimum safe recovery. Do not duplicate completed tasks.', 'child-failed');
                else if (siblingPending.length)
                    appendLedger(m, 'parent.wake.deferred', { worker_id: child.id, payload: { reason: 'sibling-workers-pending', pending: siblingPending.map(w => w.id).slice(0, 20) } });
                persistence.save(store.all());
                return;
            }
            if (ev.kind !== 'session-idle')
                return;
            if (child.runtime_recovery_pending) {
                appendLedger(m, 'worker.callback.pre-fallback-active-ignored', { task_id: child.task_id, worker_id: child.id, payload: { session_id: sid, attempt: child.runtime_recovery_attempt ?? 0, event: ev.rawType } });
                persistence.save(store.all());
                return;
            }
            if (child.status === 'completed' || child.status === 'failed' || child.status === 'cancelled')
                return;
            try {
                const messages = await listMessages(ctx.client, sid, 12), modelEvidence = lastAssistantModel(messages), text = lastAssistantText(messages);
                if (!modelEvidence && !text) {
                    appendLedger(m, 'worker.idle.pre-assistant-ignored', { task_id: child.task_id, worker_id: child.id, payload: { session_id: sid, messages: messages.length } });
                    persistence.save(store.all());
                    return;
                }
                const effective = tasks.noteEffectiveModel(m, child.id, modelEvidence ? { ...modelEvidence, source: 'assistant-message-metadata' } : undefined);
                let result = parseWorkerResult(text);
                if (!effective.ok)
                    result = { ...result, status: 'BLOCKED', summary: `Effective child model could not be verified against the selected execution model. ${effective.reason}`, open_issues: [...new Set([...(result.open_issues ?? []), effective.reason])], needs_context: [...new Set([...(result.needs_context ?? []), 'effective-model-reconcile: refresh runtime inventory/provider policy and resume with a verified role-selected model'])] };
                result = await tasks.reconcileNativeResult(m, child.id, result);
                tasks.applyResult(m, child.id, result);
                await teams.reconcileMission(m);
                if (['completed', 'failed', 'cancelled'].includes(child.status))
                    background.delete(child.id);
                else
                    background.set(child);
                store.updateProgress(m);
                appendLedger(m, 'parent.wake', { worker_id: child.id, payload: { result: result.status } });
                if (config.executionPolicy === 'adaptive' && !m.user_interrupted && !background.pendingFor(m.session_id).length)
                    await dispatchContinuation(ctx.client, m, 'Hi child result is ready. Reconcile it against current obligations. Prefer same-session corrective resume for NEEDS_CONTEXT/FIX_REQUIRED. Do not create duplicate tasks.', 'child-result-ready');
            }
            catch (e) {
                tasks.fail(m, child.id, String(e));
                appendLedger(m, 'worker.result.failed', { worker_id: child.id, payload: { error: String(e) } });
            }
            persistence.save(store.all());
            return;
        }
        if (ev.kind === 'session-deleted') {
            const parent = store.get(sid);
            if (parent) {
                await tasks.cancelAll(parent);
                store.stop(sid);
                persistence.save(store.all());
            }
            return;
        }
        if (ev.kind === 'todo-updated') {
            const m = store.get(sid);
            if (m) {
                const todos = ev.properties?.todos ?? ev.properties?.items ?? [];
                if (Array.isArray(todos))
                    m.native_todos_incomplete = todos.filter((t) => !['completed', 'cancelled', 'done'].includes(String(t?.status ?? '').toLowerCase())).length;
                store.updateProgress(m);
                persistence.save(store.all());
            }
            return;
        }
        if ((ev.kind === 'file-edited' || ev.kind === 'file-watcher-updated' || ev.kind === 'session-diff') && mission) {
            const files = eventFilePaths(ev);
            if (files.length)
                markMutation(mission, files, ev.rawType);
            persistence.save(store.all());
            return;
        }
        if (ev.kind === 'lsp-diagnostics' && mission) {
            const diagnostics = Array.isArray(ev.properties?.diagnostics) ? ev.properties.diagnostics : [];
            const errors = diagnostics.filter((d) => ['error', 1].includes(d?.severity)).length;
            addEvidence(mission, { kind: 'lsp-diagnostics', summary: `native LSP diagnostics: ${errors} error(s), ${diagnostics.length} total`, scope: mission.changed_files, source: `session:${sid}:lsp`, pass: errors === 0, outcome: errors === 0 ? 'passed' : 'failed', reason: errors ? `${errors} error diagnostic(s)` : undefined });
            persistence.save(store.all());
            return;
        }
        if (ev.kind === 'session-compacted' && mission) {
            appendLedger(mission, 'session.compacted', { payload: { source: 'native-event' } });
            persistence.save(store.all());
            return;
        }
        if (ev.kind !== 'session-idle')
            return;
        const m = store.get(sid);
        if (!m || config.executionPolicy !== 'adaptive')
            return;
        const progressed = store.updateProgress(m, false);
        void eventSink(runtimeSignal('mission.idle', m.mission_id));
        let decision = evaluateIdle(m);
        if (!progressed && shouldCountStagnation(decision)) {
            store.updateProgress(m, true);
            decision = evaluateIdle(m);
        }
        appendLedger(m, 'runtime.decision', { payload: { decision: decision.decision, reason: decision.reason, reason_code: decision.reason_code, progressed, stagnation_count: m.stagnation_count } });
        if (decision.decision === 'STOP') {
            const c = evaluateCompletion(m);
            if (c.complete)
                store.complete(sid);
            persistence.save(store.all());
            return;
        }
        if (decision.decision === 'USER_ACTION_REQUIRED') {
            m.status = 'waiting-user';
            appendLedger(m, 'user.action.required', { payload: { reason: decision.reason } });
            persistence.save(store.all());
            return;
        }
        if (decision.decision === 'RECOVER' && decision.reason_code === 'stagnation-recovery') {
            const match = /^stagnation-level-(\d+):/.exec(decision.reason);
            const level = match ? Number(match[1]) : 0;
            if (level && await tasks.recoverStagnation(m, level)) {
                store.updateProgress(m);
                persistence.save(store.all());
                return;
            }
        }
        if (decision.prompt && ['CONTINUE', 'RECONCILE', 'VERIFY', 'RECOVER'].includes(decision.decision))
            await dispatchContinuation(ctx.client, m, decision.prompt, decision.reason);
        persistence.save(store.all());
    };
    const toolSurface = { hi_doctor: doctorTool, hi_status: statusTool, hi_metrics: metricsTool, hi_ledger: ledgerTool, hi_readiness: readinessTool, hi_context_artifact_add: artifactAddTool, hi_context_artifacts: artifactsTool, hi_temporary_mutation_register: mutationTool, hi_temporary_mutation_revert: nativeRollbackTool, hi_direct_progress: directProgressTool, hi_task_start: startTool, hi_task_await: awaitTool, hi_task_peek: peekTool, hi_task_list: listTool, hi_task_cancel: cancelTool };
    assertHiToolNamespace([...Object.keys(toolSurface), 'hi_team_create', 'hi_team_message', 'hi_team_inbox', 'hi_team_message_ack', 'hi_team_member_add', 'hi_team_member_remove', 'hi_team_status', 'hi_team_board', 'hi_team_shutdown']);
    // Team tools are intentionally feature-gated. The default tool surface remains small.
    if (config.teamMode.enabled && capabilities.workerRuntime) {
        Object.assign(toolSurface, { hi_team_create: teamCreateTool, hi_team_message: teamMessageTool, hi_team_inbox: teamInboxTool, hi_team_message_ack: teamAckTool, hi_team_member_add: teamMemberAddTool, hi_team_member_remove: teamMemberRemoveTool, hi_team_status: teamStatusTool, hi_team_board: teamBoardTool, hi_team_shutdown: teamShutdownTool });
    }
    // Acquire only after initialization succeeds so a failed init cannot leave a stale process-global lease.
    const instanceLease = acquireHiRuntimeInstance(String(projectRoot));
    return {
        name: 'opencode-hi',
        tool: toolSurface,
        config: async (opencodeConfig) => {
            hostConfig = opencodeConfig;
            const resolved = resolveHiConfigWithReport(opencodeConfig.hi, projectRoot);
            config = resolved.config;
            configResolution = resolved.report;
            opencodeConfig.hi = config;
            // Git/npm plugin installs do not place Hi assets in the consumer project's .opencode tree.
            // Register the packaged skill directory and agent definitions through OpenCode's live config hook,
            // Register packaged Hi-native skills through OpenCode's live skill discovery config.
            if (existsSync(packagedSkillsDir)) {
                const skills = (opencodeConfig.skills && typeof opencodeConfig.skills === 'object' ? opencodeConfig.skills : {});
                const paths = Array.isArray(skills.paths) ? skills.paths : [];
                if (!paths.includes(packagedSkillsDir))
                    paths.push(packagedSkillsDir);
                skills.paths = paths;
                opencodeConfig.skills = skills;
            }
            const agents = (opencodeConfig.agent && typeof opencodeConfig.agent === 'object' ? opencodeConfig.agent : {});
            for (const [name, definition] of Object.entries(PACKAGED_HI_AGENTS)) {
                if (agents[name] === undefined)
                    agents[name] = definition;
                else
                    agentCollisions.push(name);
            }
            opencodeConfig.agent = agents;
            if (opencodeConfig.default_agent === undefined)
                opencodeConfig.default_agent = 'working-manager';
            if (opencodeConfig.subagent_depth === undefined)
                opencodeConfig.subagent_depth = 1;
            applyProjectAuthorityPermissions(opencodeConfig, projectAuthority);
            if (config.teamMode.enabled && capabilities.workerRuntime)
                Object.assign(toolSurface, { hi_team_create: teamCreateTool, hi_team_message: teamMessageTool, hi_team_inbox: teamInboxTool, hi_team_message_ack: teamAckTool, hi_team_member_add: teamMemberAddTool, hi_team_member_remove: teamMemberRemoveTool, hi_team_status: teamStatusTool, hi_team_board: teamBoardTool, hi_team_shutdown: teamShutdownTool });
            else
                for (const k of ['hi_team_create', 'hi_team_message', 'hi_team_inbox', 'hi_team_message_ack', 'hi_team_member_add', 'hi_team_member_remove', 'hi_team_status', 'hi_team_board', 'hi_team_shutdown'])
                    delete toolSurface[k];
        },
        'chat.message': async (input, output) => { try {
            const messageSession = String(input?.sessionID ?? input?.sessionId ?? '');
            if (messageSession && background.list().some(w => w.session_id === messageSession)) {
                await log('debug', 'Hi child chat message ignored by parent intent hook', { session_id: messageSession });
                return;
            }
            if (!models.length)
                void refreshRuntimeInventory('chat-message');
            await createChatMessageHook(store, async (sid) => { const m = store.get(sid); if (m) {
                await teams.shutdownMission(m);
                await tasks.cancelAll(m);
            } }, async (sid, text, kind) => { if (kind !== 'constraint')
                return; const m = store.get(sid); if (m) {
                await teams.shutdownMission(m);
                const n = await tasks.reconcileUserConstraint(m, text);
                appendLedger(m, 'constraint.reconciled', { payload: { workers: n, generation: m.generation, preview: text.slice(0, 200) } });
            } })(input, output);
        }
        finally {
            persistence.save(store.all());
        } },
        'experimental.chat.messages.transform': createMessagesTransformHook(store, background),
        'experimental.chat.system.transform': createSystemTransformHook(store, background, () => config.primaryMode),
        'experimental.session.compacting': async (input, output) => { try {
            await experimental.compacting()(input, output);
        }
        finally {
            persistence.save(store.all());
        } },
        'tool.execute.before': async (input, output) => { try {
            await createToolBeforeHook(store, background, projectRoot)(input, output);
        }
        finally {
            persistence.save(store.all());
        } },
        'tool.execute.after': async (input, output) => { try {
            await createToolAfterHook(store, background, eventSink, projectRoot)(input, output);
        }
        finally {
            persistence.save(store.all());
        } },
        dispose: async () => { try {
            for (const m of store.all())
                if (m.status === 'active') {
                    await teams.shutdownMission(m);
                    await tasks.cancelAll(m);
                }
            persistence.markCleanShutdown(store.all());
        }
        finally {
            instanceLease.release();
        } },
        event: onEvent,
    };
};
export default HiPlugin;
