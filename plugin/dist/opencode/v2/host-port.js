import { runtimeTruthCapabilities } from '../../contracts/host-capability.js';
import { normalizeModelCapabilityProfile } from '../../contracts/model.js';
function contract(id, status, primitive, fallback, loss, acceptance) { return { id, host_id: 'opencode', status, verification_level: 'OBSERVED', ...(primitive ? { native_primitive: primitive } : {}), adapter_entrypoint: 'OpenCodeV2Adapter', ...(fallback ? { fallback } : {}), semantic_loss: loss, required_permissions: [], acceptance_ref: acceptance, forbidden_fake_behavior: `V2 capability ${id} must be discovered from the active Promise context; adapter presence alone is not support.` }; }
export function v2HostCapabilityView(ctx) {
    const create = typeof ctx.session?.create === 'function', prompt = typeof ctx.session?.prompt === 'function', abort = typeof ctx.session?.interrupt === 'function', status = typeof ctx.session?.get === 'function', inventory = typeof ctx.catalog?.model?.list === 'function' || typeof ctx.catalog?.provider?.list === 'function';
    const contracts = [
        contract('child-session-create', create ? 'SUPPORTED' : 'UNSUPPORTED', create ? 'session.create' : undefined, undefined, create ? [] : ['native create absent'], 'plugin/test/v2-host-adapter.test.mjs'),
        contract('session-prompt', prompt ? 'SUPPORTED' : 'UNSUPPORTED', prompt ? 'session.prompt(delivery=queue)' : undefined, undefined, prompt ? [] : ['native prompt absent'], 'plugin/test/v2-host-adapter.test.mjs'),
        contract('session-abort', abort ? 'SUPPORTED' : 'UNSUPPORTED', abort ? 'session.interrupt(continue=false)' : undefined, undefined, abort ? [] : ['native interrupt absent'], 'plugin/test/v2-host-adapter.test.mjs'),
        contract('provider-inventory', inventory ? 'SUPPORTED' : 'DEGRADED', inventory ? 'catalog.model.list/catalog.provider.list' : undefined, inventory ? undefined : 'host-default compatibility delegation', inventory ? [] : ['adaptive inventory-aware routing unavailable'], 'plugin/test/v2-host-adapter.test.mjs'),
        contract('structured-log', 'DEGRADED', undefined, 'bounded local runtime state/doctor only', ['V2 Promise context exposes no app.log primitive'], 'plugin/test/v2-host-adapter.test.mjs'),
        contract('session-status', status ? 'SUPPORTED' : 'DEGRADED', status ? 'session.get + event stream' : undefined, status ? undefined : 'event/runtime-owned state reconciliation', status ? [] : ['independent status unavailable'], 'plugin/test/v2-host-adapter.test.mjs'),
        contract('child-session-list', 'DEGRADED', undefined, 'Hi-owned worker registry', ['foreign/native children are not exhaustively enumerable'], 'plugin/test/v2-host-adapter.test.mjs'),
        contract('session-todo', 'DEGRADED', undefined, 'Hi Mission/Task state', ['native todo parity unavailable'], 'plugin/test/v2-host-adapter.test.mjs'),
        contract('session-diff', 'DEGRADED', undefined, 'file events + WorkerResult changed_files', ['native session diff unavailable in V2 Promise context'], 'plugin/test/v2-host-adapter.test.mjs'),
        contract('session-fork', 'DEGRADED', undefined, 'fresh child session creation', ['native fork unavailable in V2 Promise context'], 'plugin/test/v2-host-adapter.test.mjs'),
        contract('session-summarize', 'DEGRADED', undefined, 'bounded Hi context projection', ['native summarize unavailable in V2 Promise context'], 'plugin/test/v2-host-adapter.test.mjs'),
        contract('session-revert', 'DEGRADED', undefined, 'exact rollback command only for native-coverage gaps', ['native session revert unavailable in exposed V2 Promise context'], 'plugin/test/v2-host-adapter.test.mjs'),
        contract('session-unrevert', 'UNSUPPORTED', undefined, undefined, [], 'plugin/test/v2-host-adapter.test.mjs'),
        contract('worker-runtime', create && prompt && abort ? 'SUPPORTED' : 'UNSUPPORTED', create && prompt && abort ? 'session.create + session.prompt + session.interrupt' : undefined, undefined, create && prompt && abort ? [] : ['required V2 worker primitives incomplete'], 'plugin/test/v2-host-adapter.test.mjs'),
        contract('structured-human-decision-transport', 'UNSUPPORTED', undefined, undefined, [], 'structured-human-decision-host.test.mjs'),
        contract('browser-execution', 'UNSUPPORTED', undefined, undefined, ['runtime health not yet observed'], 'plugin/test/v2-host-adapter.test.mjs'),
        contract('process-lifecycle', 'UNSUPPORTED', undefined, undefined, ['V2 Promise plugin context has shell hooks but no owned PTY lifecycle surface'], 'plugin/test/v2-host-adapter.test.mjs'),
        contract('workspace-isolation-binding', 'UNSUPPORTED', undefined, undefined, ['V2 Promise plugin context exposes location binding but no workspace provision/remove owner'], 'plugin/test/v2-host-adapter.test.mjs')
    ];
    const negotiated = runtimeTruthCapabilities(contracts), degraded = negotiated.filter(x => x.status !== 'SUPPORTED').map(x => `${x.id}:${x.status.toLowerCase()}`);
    return { childSessions: create, asyncPrompt: prompt, syncPrompt: false, abort, providerInventory: inventory, appLog: false, sessionStatus: status, childSessionList: false, sessionTodo: false, sessionDiff: false, sessionFork: false, sessionSummarize: false, sessionRevert: false, sessionUnrevert: false, workerRuntime: create && prompt && abort, degraded, contracts: negotiated };
}
function asItems(raw) { if (Array.isArray(raw))
    return raw; if (Array.isArray(raw?.data))
    return raw.data; if (Array.isArray(raw?.all))
    return raw.all; return []; }
function modelsFrom(raw) { return asItems(raw).flatMap((m) => { const provider = String(m?.providerID ?? m?.provider?.id ?? '').trim(), id = String(m?.id ?? m?.modelID ?? '').trim(); if (!provider || !id)
    return []; const canonical = id.startsWith(provider + '/') ? id : `${provider}/${id}`; const input = m?.capabilities?.input; const vision = Array.isArray(input) ? input.some((x) => String(x).toLowerCase() === 'image') : input?.image === true; const variants = Array.isArray(m?.variants) ? m.variants.map((x) => typeof x === 'string' ? x : x?.id).filter(Boolean) : []; return [normalizeModelCapabilityProfile({ id: canonical, provider, cost: 0, quality: 0, writeCapable: true, visionCapable: vision, tags: [], variants }, 'runtime-inventory', `v2-catalog:${canonical}`)]; }); }
function v2AssistantUsage(info) { const tokens = info?.tokens, cache = tokens?.cache, values = [tokens?.input, tokens?.output, tokens?.reasoning, cache?.read, cache?.write]; if (values.some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0))
    return undefined; const provider = info?.model?.providerID ?? info?.providerID, modelID = info?.model?.id ?? info?.modelID, message_id = info?.id, observed_at = Number(info?.time?.completed ?? info?.time?.created), cost = typeof info?.cost === 'number' && Number.isFinite(info.cost) && info.cost >= 0 ? info.cost : undefined; return { ...(message_id ? { message_id: String(message_id) } : {}), ...(provider && modelID ? { model_identity: `${String(provider)}/${String(modelID)}` } : modelID && String(modelID).includes('/') ? { model_identity: String(modelID) } : {}), ...(Number.isFinite(observed_at) && observed_at >= 0 ? { observed_at } : {}), token_source: 'opencode-assistant-message', coverage: 'assistant-message-reported', confidence: 'exact', step_count: 1, tokens: { input: tokens.input, output: tokens.output, reasoning: tokens.reasoning, cache_read: cache.read, cache_write: cache.write }, ...(cost === undefined ? {} : { monetary: { usd: cost, source: 'opencode-calculated', confidence: 'derived' } }) }; }
function assistant(raw) { const latest = [...raw].reverse().find((m) => String(m?.type ?? m?.role ?? m?.info?.role ?? '') === 'assistant') ?? [...raw].reverse()[0]; if (!latest)
    return { text: '' }; const body = latest?.content ?? latest?.parts ?? latest?.message?.content ?? []; const text = Array.isArray(body) ? body.filter((x) => x?.type === 'text' || typeof x?.text === 'string').map((x) => String(x.text ?? '')).join('\n') : typeof body === 'string' ? body : ''; const info = latest?.info ?? latest, usage = v2AssistantUsage(info); return { text, model: { model: info?.model?.providerID && info?.model?.id ? `${String(info.model.providerID)}/${String(info.model.id)}` : info?.model?.id ?? info?.modelID, variant: info?.model?.variant, message_id: info?.id, parent_id: info?.parentID, created_at: Number(info?.time?.created ?? 0) || undefined }, ...(usage ? { usage } : {}) }; }
export function createV2HostPort(ctx, facts) {
    const capabilities = v2HostCapabilityView(ctx);
    let models = [];
    const refreshRuntimeInventory = async () => { try {
        const raw = await ctx.catalog?.model?.list?.({ location: { directory: ctx.location.directory, workspace: ctx.location.workspaceID } });
        models = modelsFrom(raw);
        return models.length;
    }
    catch {
        return models.length;
    } };
    const sessionStatus = async (id) => { const cached = facts.status.get(id); try {
        const s = await ctx.session.get({ sessionID: id });
        if (s?.outcome || s?.time?.idle) {
            facts.status.set(id, 'idle');
            return 'idle';
        }
        return cached ?? 'unknown';
    }
    catch {
        return cached ?? 'unknown';
    } };
    return { capabilities, nativeSession: { diff: async () => { throw new Error('UNSUPPORTED_CAPABILITY: OpenCode V2 Promise context does not expose native session diff'); }, revert: async () => { throw new Error('UNSUPPORTED_CAPABILITY: OpenCode V2 Promise context does not expose native session revert'); } }, log: async (level, message, extra) => { const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.debug; fn('[opencode-hi:v2]', message, extra ?? {}); }, refreshRuntimeInventory, getModels: () => models, readAssistantResult: async (id) => assistant(await ctx.session.context({ sessionID: id })), sessionStatus, continueSession: async (id, text, metadata) => { if (!ctx.session.synthetic)
            return false; facts.status.set(id, 'busy'); await ctx.session.synthetic({ sessionID: id, text, metadata, delivery: 'steer', resume: true }); return true; } };
}
export function createV2OwnedCapabilityObserver(contracts) {
    const replace = (id, next) => { const i = contracts.findIndex(x => x.id === id); if (i >= 0)
        contracts.splice(i, 1, next);
    else
        contracts.push(next); };
    const observe = async (id) => {
        const detail = id === 'process-lifecycle' ? 'V2 Promise plugin context exposes shell policy hooks but no owned PTY lifecycle API' : 'V2 Promise plugin context exposes current location binding but no workspace provision/remove API';
        return { available: false, detail };
    };
    const setBrowserAvailable = (available) => replace('browser-execution', contract('browser-execution', available ? 'SUPPORTED' : 'UNSUPPORTED', available ? 'Hi-owned Playwright BrowserExecutor health observation' : undefined, undefined, available ? [] : ['runtime browser health unavailable'], 'plugin/test/v2-host-adapter.test.mjs'));
    return { observe, setBrowserAvailable };
}
