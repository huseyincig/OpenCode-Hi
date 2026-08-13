export function dataOf(value) { return (value && typeof value === 'object' && 'data' in value) ? value.data : value; }
export async function createChildSession(client, parentID, title, agent, model, variant) {
    if (typeof client?.session?.create !== 'function')
        throw new Error('OpenCode session.create unavailable');
    const body = { parentID, title };
    if (agent)
        body.agent = agent;
    const identity = modelIdentity(model);
    if (identity)
        body.model = { id: identity.modelID, providerID: identity.providerID, ...(variant ? { variant } : {}) };
    return dataOf(await client.session.create({ body }));
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
    if (typeof client?.session?.promptAsync === 'function') {
        await client.session.promptAsync({ path: { id: sessionID }, body });
        return;
    }
    if (typeof client?.session?.prompt_async === 'function') {
        await client.session.prompt_async({ path: { id: sessionID }, body });
        return;
    }
    if (typeof client?.session?.prompt === 'function') {
        await client.session.prompt({ path: { id: sessionID }, body });
        return;
    }
    throw new Error('OpenCode session prompt API unavailable');
}
export async function listMessages(client, sessionID, limit = 20) {
    if (typeof client?.session?.messages === 'function')
        return dataOf(await client.session.messages({ path: { id: sessionID }, query: { limit } })) ?? [];
    if (typeof client?.session?.message?.list === 'function')
        return dataOf(await client.session.message.list({ path: { id: sessionID }, query: { limit } })) ?? [];
    return [];
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
    if (endpoint.serverUrl) {
        try {
            const base = endpoint.serverUrl.replace(/\/$/, '');
            const response = await fetch(`${base}/session/${encodeURIComponent(sessionID)}/abort`, { method: 'POST', headers: lifecycleHeaders(endpoint.directory), signal: AbortSignal.timeout(5000) });
            if (response.ok)
                return 'server';
        }
        catch { }
    }
    if (typeof client?.session?.abort === 'function') {
        await client.session.abort({ path: { id: sessionID } });
        return 'client';
    }
    return 'unavailable';
}
export async function listProviders(client) { if (typeof client?.provider?.list === 'function')
    return dataOf(await client.provider.list()); if (typeof client?.config?.providers === 'function')
    return dataOf(await client.config.providers()); return undefined; }
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
