import { createOpencodeClient as createOpenCodeV2Client } from '@opencode-ai/sdk/v2/client';
import { EMPTY_TOKEN_USAGE, addTokenUsage } from '../contracts/execution-usage.js';
export function dataOf(value) { return (value && typeof value === 'object' && 'data' in value) ? value.data : value; }
export async function createChildSession(client, parentID, title, agent, model, variant, workspaceID, endpoint = {}) {
    const identity = modelIdentity(model);
    if (workspaceID && endpoint.serverUrl && endpoint.directory) {
        const v2 = createOpenCodeV2Client({ baseUrl: endpoint.serverUrl, directory: endpoint.directory }), session = v2?.session;
        if (!session || typeof session.create !== 'function')
            throw new Error('OpenCode canonical v2 session.create unavailable for workspace binding');
        const params = { parentID, title, workspace: workspaceID, workspaceID };
        if (agent)
            params.agent = agent;
        if (identity)
            params.model = { id: identity.modelID, providerID: identity.providerID, ...(variant ? { variant } : {}) };
        return dataOf(await session.create(params));
    }
    const edge = client;
    if (typeof edge?.session?.create !== 'function')
        throw new Error('OpenCode session.create unavailable');
    const body = { parentID, title };
    if (agent)
        body.agent = agent;
    if (workspaceID)
        body.workspaceID = workspaceID;
    if (identity)
        body.model = { id: identity.modelID, providerID: identity.providerID, ...(variant ? { variant } : {}) };
    return dataOf(await edge.session.create({ body }));
}
export function modelIdentity(model) {
    if (!model)
        return undefined;
    const slash = model.indexOf('/');
    if (slash <= 0 || slash === model.length - 1)
        return undefined;
    return { providerID: model.slice(0, slash), modelID: model.slice(slash + 1) };
}
export async function sendPromptAsync(client, sessionID, text, agent, model, variant, tools) {
    const edge = client;
    const body = { parts: [{ type: 'text', text }] };
    if (agent)
        body.agent = agent;
    const identity = modelIdentity(model);
    if (identity)
        body.model = identity;
    if (variant)
        body.variant = variant;
    if (tools && Object.keys(tools).length)
        body.tools = tools;
    if (typeof edge?.session?.promptAsync === 'function') {
        await edge.session.promptAsync({ path: { id: sessionID }, body });
        return;
    }
    if (typeof edge?.session?.prompt_async === 'function') {
        await edge.session.prompt_async({ path: { id: sessionID }, body });
        return;
    }
    if (typeof edge?.session?.prompt === 'function') {
        await edge.session.prompt({ path: { id: sessionID }, body });
        return;
    }
    throw new Error('OpenCode session prompt API unavailable');
}
export async function listMessages(client, sessionID, limit = 20) {
    const edge = client;
    if (typeof edge?.session?.messages === 'function')
        return dataOf(await edge.session.messages({ path: { id: sessionID }, query: { limit } })) ?? [];
    if (typeof edge?.session?.message?.list === 'function')
        return dataOf(await edge.session.message.list({ path: { id: sessionID }, query: { limit } })) ?? [];
    return [];
}
export async function sendSyntheticContinuation(client, sessionID, text, metadata) {
    const edge = client;
    const fn = typeof edge?.session?.promptAsync === 'function' ? edge.session.promptAsync.bind(edge.session) : typeof edge?.session?.prompt_async === 'function' ? edge.session.prompt_async.bind(edge.session) : typeof edge?.session?.prompt === 'function' ? edge.session.prompt.bind(edge.session) : undefined;
    if (!fn)
        return false;
    await fn({ path: { id: sessionID }, body: { parts: [{ type: 'text', text, synthetic: true, metadata }], noReply: false } });
    return true;
}
function lifecycleHeaders(directory) {
    const headers = {};
    if (directory)
        headers['x-opencode-directory'] = encodeURIComponent(directory);
    const password = process.env.OPENCODE_SERVER_PASSWORD;
    if (password) {
        const username = process.env.OPENCODE_SERVER_USERNAME ?? 'opencode';
        headers.Authorization = `Basic ${btoa(`${username}:${password}`)}`;
    }
    return headers;
}
export async function abortSession(client, sessionID, endpoint = {}) {
    const edge = client;
    if (endpoint.serverUrl) {
        try {
            const base = endpoint.serverUrl.replace(/\/$/, '');
            const response = await fetch(`${base}/session/${encodeURIComponent(sessionID)}/abort`, { method: 'POST', headers: lifecycleHeaders(endpoint.directory), signal: AbortSignal.timeout(5000) });
            if (response.ok)
                return 'server';
        }
        catch { }
    }
    if (typeof edge?.session?.abort === 'function') {
        await edge.session.abort({ path: { id: sessionID } });
        return 'client';
    }
    return 'unavailable';
}
export async function listProviders(client) { const edge = client; if (typeof edge?.provider?.list === 'function')
    return dataOf(await edge.provider.list()); if (typeof edge?.config?.providers === 'function')
    return dataOf(await edge.config.providers()); return undefined; }
export function eventSessionID(event) { return event?.properties?.sessionID ?? event?.properties?.sessionId ?? event?.properties?.id ?? event?.properties?.info?.id ?? event?.sessionID; }
export function lastAssistantText(messages) { for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const info = msg?.info ?? msg?.message ?? msg;
    if (info?.role && info.role !== 'assistant')
        continue;
    const parts = msg?.parts ?? info?.parts ?? [];
    const text = parts.filter((p) => p?.type === 'text' && typeof p.text === 'string').map((p) => p.text).join('\n').trim();
    if (text)
        return text;
} return ''; }
export function lastAssistantModel(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i], info = msg?.info ?? msg?.message ?? msg;
        if (info?.role && info.role !== 'assistant')
            continue;
        const provider = info?.providerID ?? info?.providerId ?? info?.model?.providerID ?? info?.model?.providerId ?? info?.provider;
        const modelID = info?.modelID ?? info?.modelId ?? info?.model?.modelID ?? info?.model?.modelId ?? info?.model?.id ?? (typeof info?.model === 'string' ? info.model : undefined);
        const canonical = provider && modelID ? `${String(provider)}/${String(modelID)}` : (typeof modelID === 'string' && modelID.includes('/') ? modelID : undefined);
        if (canonical)
            return { model: canonical, variant: info?.variant ?? info?.model?.variant, message_id: info?.id ?? msg?.id };
    }
    return undefined;
}
function usageTokens(value) {
    const tokens = value?.tokens, cache = tokens?.cache;
    const values = [tokens?.input, tokens?.output, tokens?.reasoning, cache?.read, cache?.write];
    if (values.some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0))
        return undefined;
    return { input: tokens.input, output: tokens.output, reasoning: tokens.reasoning, cache_read: cache.read, cache_write: cache.write };
}
export function lastAssistantUsage(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i], info = msg?.info ?? msg?.message ?? msg;
        if (info?.role && info.role !== 'assistant')
            continue;
        const parts = msg?.parts ?? info?.parts ?? [], steps = parts.filter((p) => p?.type === 'step-finish');
        const provider = info?.providerID ?? info?.providerId ?? info?.model?.providerID ?? info?.model?.providerId ?? info?.provider, modelID = info?.modelID ?? info?.modelId ?? info?.model?.modelID ?? info?.model?.modelId ?? info?.model?.id ?? (typeof info?.model === 'string' ? info.model : undefined), model_identity = provider && modelID ? `${String(provider)}/${String(modelID)}` : (typeof modelID === 'string' && modelID.includes('/') ? modelID : undefined), message_id = info?.id ?? msg?.id, observed_at = Number(info?.time?.completed ?? info?.time?.created);
        if (steps.length) {
            let tokens = { ...EMPTY_TOKEN_USAGE }, cost = 0;
            for (const step of steps) {
                const parsed = usageTokens(step);
                if (!parsed || typeof step.cost !== 'number' || !Number.isFinite(step.cost) || step.cost < 0)
                    return undefined;
                tokens = addTokenUsage(tokens, parsed);
                cost += step.cost;
            }
            return { ...(message_id ? { message_id: String(message_id) } : {}), ...(model_identity ? { model_identity } : {}), ...(Number.isFinite(observed_at) && observed_at >= 0 ? { observed_at } : {}), token_source: 'opencode-step-finish', coverage: 'assistant-step-total', confidence: 'exact', step_count: steps.length, tokens, monetary: { usd: cost, source: 'opencode-calculated', confidence: 'derived' } };
        }
        const tokens = usageTokens(info);
        if (!tokens)
            return undefined;
        const cost = typeof info?.cost === 'number' && Number.isFinite(info.cost) && info.cost >= 0 ? info.cost : undefined;
        return { ...(message_id ? { message_id: String(message_id) } : {}), ...(model_identity ? { model_identity } : {}), ...(Number.isFinite(observed_at) && observed_at >= 0 ? { observed_at } : {}), token_source: 'opencode-assistant-message', coverage: 'assistant-message-reported', confidence: 'exact', step_count: 1, tokens, ...(cost === undefined ? {} : { monetary: { usd: cost, source: 'opencode-calculated', confidence: 'derived' } }) };
    }
    return undefined;
}
