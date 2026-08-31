import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PACKAGED_HI_AGENTS } from '../../generated/agent-config.js';
import { resolveHiConfigWithReport } from '../../config/resolver.js';
import { createChatMessageHook } from '../../hooks/chat-message.js';
import { createMessagesTransformHook } from '../../hooks/messages-transform.js';
import { createSystemTransformHook } from '../../hooks/system-transform.js';
import { createToolBeforeHook } from '../../hooks/tool-before.js';
import { createToolAfterHook } from '../../hooks/tool-after.js';
import { syncHumanDecisionTransport } from '../../runtime/human-decision/transport.js';
import { appendLedger } from '../../runtime/ledger/ledger.js';
import { normalizeOpenCodeEvent } from '../event-adapter.js';
const DEFAULT_RULES = [
    { action: '*', resource: '*', effect: 'allow' },
    { action: 'external_directory', resource: '*', effect: 'ask' },
    { action: 'read', resource: '*.env', effect: 'ask' },
    { action: 'read', resource: '*.env.*', effect: 'ask' },
    { action: 'read', resource: '*.env.example', effect: 'allow' },
];
function permissionTargets(key) {
    if (key === 'task')
        return [{ action: 'subagent', resource: '*' }];
    if (key === 'bash')
        return [{ action: '*', resource: 'execute' }, { action: '*', resource: 'bash' }];
    return [{ action: '*', resource: key }];
}
export function adaptV2Permissions(value) {
    const out = DEFAULT_RULES.map(x => ({ ...x }));
    if (typeof value === 'string') {
        out.push({ action: '*', resource: '*', effect: value });
        return out;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return out;
    for (const [key, effect] of Object.entries(value)) {
        if (typeof effect === 'string')
            for (const target of permissionTargets(key))
                out.push({ ...target, effect });
        else if (effect && typeof effect === 'object' && !Array.isArray(effect))
            for (const [pattern, sub] of Object.entries(effect))
                if (typeof sub === 'string')
                    out.push({ action: pattern, resource: key, effect: sub });
    }
    return out;
}
function applyAgent(draft, id, cfg) {
    draft.update(id, (agent) => {
        agent.id = id;
        agent.name = id;
        agent.mode = cfg.mode ?? 'subagent';
        agent.hidden = cfg.hidden === true;
        if (typeof cfg.description === 'string')
            agent.description = cfg.description;
        if (typeof cfg.prompt === 'string')
            agent.system = cfg.prompt.replace(/\bsubagent_type\b/g, 'agent').replace(/\btask\s*\(/g, 'subagent(');
        if (Number.isInteger(cfg.steps) && cfg.steps > 0)
            agent.steps = cfg.steps;
        agent.request = { settings: {}, headers: {}, body: {} };
        agent.permissions = adaptV2Permissions(cfg.permission);
    });
}
function skillEntries(root) {
    const out = [];
    try {
        for (const entry of readdirSync(root, { withFileTypes: true })) {
            if (!entry.isDirectory())
                continue;
            const file = join(root, entry.name, 'SKILL.md');
            try {
                if (!statSync(file).isFile())
                    continue;
                const content = readFileSync(file, 'utf8');
                const title = (content.match(/^#\s+(.+)$/m)?.[1] ?? entry.name).trim();
                const desc = (content.match(/^description:\s*["']?([^\n"']+)/m)?.[1] ?? '').trim();
                out.push({ id: entry.name, name: title, ...(desc ? { description: desc } : {}), location: file, content });
            }
            catch { }
        }
    }
    catch { }
    return out;
}
function inputSchema(def) { const args = def?.args && typeof def.args === 'object' ? def.args : {}; const nested = args.input; if (nested && typeof nested === 'object' && nested.type === 'object')
    return nested; const properties = {}; for (const [k, v] of Object.entries(args))
    properties[k] = v; return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false }; }
function toolResult(value) { if (typeof value === 'string')
    return { content: value }; if (value && typeof value === 'object') {
    if (typeof value.output === 'string')
        return { content: value.output, metadata: value.metadata ?? {} };
    return { output: value, content: JSON.stringify(value) };
} return { content: String(value ?? '') }; }
function toolContext(ctx, directory) { return { sessionID: String(ctx?.sessionID ?? ''), messageID: String(ctx?.messageID ?? ''), agent: String(ctx?.agent ?? ''), directory, worktree: directory, abort: new AbortController().signal, metadata: () => { }, ask: async () => { } }; }
function legacyMessages(messages) { return messages.map((m) => ({ info: { ...(m?.info ?? {}), role: m?.role ?? m?.info?.role }, parts: Array.isArray(m?.content) ? m.content : Array.isArray(m?.parts) ? m.parts : [] })); }
export function v2EventStatus(event) {
    const type = String(event?.type ?? '');
    if (type === 'session.idle')
        return 'idle';
    const data = event?.data ?? event?.properties ?? {};
    if (type === 'session.status') {
        const raw = String(data?.status?.type ?? data?.status ?? event?.status?.type ?? event?.status ?? '').toLowerCase();
        if (raw.includes('busy') || raw.includes('running'))
            return 'busy';
        if (raw.includes('retry'))
            return 'retry';
        if (raw.includes('idle'))
            return 'idle';
        return 'unknown';
    }
    if (type === 'session.deleted' || type === 'session.error')
        return 'idle';
    return undefined;
}
export function normalizeV2Event(event) {
    const properties = event?.data ?? event?.properties ?? {};
    const normalized = normalizeOpenCodeEvent({ ...event, properties });
    if (event?.type === 'session.compaction.ended') {
        return { ...normalized, kind: 'session-compacted', rawType: 'session.compaction.ended' };
    }
    return normalized;
}
async function disposeRuntime(runtime) {
    const { services, eventController, instanceLease } = runtime, { store, humanDecisionTransport, persistence, processRuntime, browserExecutor, previewManager } = services;
    try {
        for (const m of store.all())
            if (['active', 'waiting-user'].includes(m.identity.status)) {
                await processRuntime.stopMission(m);
                appendLedger(m, 'runtime.plugin-disposed', { payload: { mission_status: m.identity.status, durable_mission_preserved: true, semantic_stop: false } });
            }
        humanDecisionTransport.dispose();
        eventController.clearAllNativePermissions();
        const browserDisposable = browserExecutor;
        if (browserDisposable.dispose)
            await browserDisposable.dispose();
        await previewManager.dispose();
        persistence.markCleanShutdown(store.all());
    }
    finally {
        instanceLease.release();
    }
}
export async function registerV2Lifecycle(ctx, runtime, facts) {
    const { state, host, services, projectRoot, workingDirectory, packagedSkillsDir, toolSurface, eventController } = runtime;
    const { store, background, humanDecisionTransport, persistence, tasks, eventSink } = services, registrations = [];
    state.hostConfig = { ...(ctx.options ?? {}), host_generation: 'v2-promise' };
    const resolved = resolveHiConfigWithReport(ctx.options?.hi, projectRoot);
    state.config = resolved.config;
    state.configResolution = resolved.report;
    const sync = () => { for (const m of store.all())
        syncHumanDecisionTransport(m.authority.human_decision, humanDecisionTransport); };
    registrations.push(await ctx.agent.transform(draft => { for (const [id, cfg] of Object.entries(PACKAGED_HI_AGENTS))
        applyAgent(draft, id, cfg); }));
    if (ctx.skill?.transform) {
        registrations.push(await ctx.skill.transform((draft) => { const existing = new Set((draft.list?.() ?? []).map((x) => String(x?.id ?? ''))); for (const skill of skillEntries(packagedSkillsDir)) {
            if (existing.has(skill.id))
                throw new Error(`OpenCode-Hi V2 skill collision: ${skill.id}`);
            draft.add(skill);
        } }));
        await ctx.skill.reload?.();
    }
    registrations.push(await ctx.tool.transform(draft => { for (const [name, raw] of Object.entries(toolSurface)) {
        const def = raw;
        draft.add({ name, description: String(def?.description ?? name), input: inputSchema(def), options: { codemode: false }, execute: async (args, tctx) => toolResult(await def.execute(args, toolContext(tctx, workingDirectory))) });
    } }));
    await ctx.tool.reload?.();
    registrations.push(await ctx.session.hook('prompt', async (event) => { const sessionID = String(event.sessionID ?? ''); facts.status.set(sessionID, 'busy'); try {
        if (sessionID && background.list().some(w => w.session_id === sessionID)) {
            await host.log('debug', 'Hi V2 child prompt ignored by parent intent hook', { session_id: sessionID });
            return;
        }
        const text = String(event?.prompt?.text ?? event?.text ?? '');
        await createChatMessageHook(store, async (sid, follow) => { const m = store.get(sid); if (!m)
            return; const workersPaused = await tasks.pauseForSemanticAssessment(m); appendLedger(m, 'semantic.execution-quarantined', { payload: { revision: m.identity.semantic_assessment.revision, workers: workersPaused, preview: follow.slice(0, 180) } }); }, humanDecisionTransport)({ sessionID, agent: event.agent }, { message: { role: 'user' }, parts: [{ type: 'text', text }] });
        tasks.wakeQueued();
    }
    finally {
        sync();
        persistence.save(store.all());
    } }));
    registrations.push(await ctx.session.hook('context', async (event) => { const legacy = legacyMessages(event.messages ?? []); const output = { messages: legacy }; await createMessagesTransformHook(store, background)({ sessionID: event.sessionID, agent: event.agent }, output); for (let i = 0; i < legacy.length; i++)
        if (event.messages?.[i])
            event.messages[i].content = legacy[i].parts; const initial = (event.system ?? []).filter((x) => x?.type === 'text' && typeof x.text === 'string').map((x) => x.text); const sys = { system: [...initial] }; await createSystemTransformHook(store, background, projectRoot, workingDirectory, () => ({ pending: false, modelCount: host.getModels().length }))({ sessionID: event.sessionID, agent: event.agent }, sys); for (const text of sys.system.slice(initial.length))
        event.system.push({ type: 'text', text }); }));
    registrations.push(await ctx.tool.hook('execute.before', async (event) => { const output = { args: event.input }; await createToolBeforeHook(store, background, projectRoot, workingDirectory)({ tool: event.tool, sessionID: event.sessionID, callID: event.id, args: event.input }, output); event.input = output.args; sync(); persistence.save(store.all()); }));
    registrations.push(await ctx.tool.hook('execute.after', async (event) => { if (event.status !== 'completed')
        return; const result = event.result ?? {}; const output = { output: typeof result?.content === 'string' ? result.content : typeof result?.output === 'string' ? result.output : JSON.stringify(result?.output ?? result?.content ?? ''), metadata: result?.metadata ?? {} }; await createToolAfterHook(store, background, eventSink, projectRoot, workingDirectory)({ tool: event.tool, sessionID: event.sessionID, callID: event.id, args: event.input }, output); sync(); persistence.save(store.all()); }));
    const iterator = ctx.event.subscribe()[Symbol.asyncIterator](), pump = (async () => { try {
        for (;;) {
            const next = await iterator.next();
            if (next.done)
                break;
            const raw = next.value, status = v2EventStatus(raw), data = raw?.data ?? raw?.properties ?? {}, sid = String(data?.sessionID ?? data?.info?.id ?? raw?.sessionID ?? '');
            if (status && sid)
                facts.status.set(sid, status);
            try {
                await eventController.handle(normalizeV2Event(raw));
            }
            finally {
                sync();
            }
        }
    }
    catch (error) {
        await host.log('warn', 'OpenCode V2 event pump stopped', { error: String(error) });
    } })();
    void pump;
    await host.refreshRuntimeInventory('v2-setup');
    await host.log('info', 'OpenCode-Hi V2 Promise lifecycle registered', { agents: Object.keys(PACKAGED_HI_AGENTS).length, tools: Object.keys(toolSurface).length, skills: skillEntries(packagedSkillsDir).length, capabilities: host.capabilities });
    return async () => { try {
        await iterator.return?.();
        await Promise.allSettled(registrations.reverse().map(r => Promise.resolve(r.dispose())));
    }
    finally {
        await disposeRuntime(runtime);
    } };
}
