import { createOpencodeClient as createOpenCodeV2Client } from '@opencode-ai/sdk/v2/client';
import { EMPTY_TOKEN_USAGE, addTokenUsage } from '../contracts/execution-usage.js';
export function dataOf(value) { return (value && typeof value === 'object' && 'data' in value) ? value.data : value; }
// `prompt_async` is an immediate OpenCode host-acceptance mutation. This bounds only that acknowledgement; provider execution remains OpenCode-owned.
const HOST_MUTATION_ACK_TIMEOUT_MS = 15_000;
class OpenCodeMutationAckTimeoutError extends Error {
    code = 'ETIMEDOUT';
    constructor(operation, timeoutMs) { super(`OpenCode ${operation} acknowledgement timed out after ${timeoutMs}ms`); this.name = 'OpenCodeMutationAckTimeoutError'; }
}
async function awaitPromptAsyncAck(invoke, operation, timeoutMs) {
    const bounded = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.floor(timeoutMs) : HOST_MUTATION_ACK_TIMEOUT_MS, controller = new AbortController(), pending = Promise.resolve().then(() => invoke(controller.signal));
    pending.catch(() => { });
    let timer;
    try {
        return await Promise.race([pending, new Promise((_resolve, reject) => { timer = setTimeout(() => { const error = new OpenCodeMutationAckTimeoutError(operation, bounded); controller.abort(error); reject(error); }, bounded); })]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
function mutationResultError(value) { return value && typeof value === 'object' && 'error' in value && value.error ? value.error : undefined; }
function mutationErrorText(value) { if (value instanceof Error && value.message.trim())
    return value.message.trim(); if (value && typeof value === 'object') {
    const v = value;
    for (const item of [v?.data?.message, v?.message, v?.name])
        if (typeof item === 'string' && item.trim())
            return item.trim();
} return String(value); }
function assertMutationAccepted(value, operation) { const rejected = mutationResultError(value); if (rejected === undefined)
    return; if (rejected instanceof Error)
    throw rejected; const error = new Error(`OpenCode ${operation} rejected: ${mutationErrorText(rejected)}`); error.cause = rejected; throw error; }
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
export async function sendPromptAsync(client, sessionID, text, agent, model, variant, tools, ackTimeoutMs = HOST_MUTATION_ACK_TIMEOUT_MS, messageID, format) {
    const edge = client;
    const body = { parts: [{ type: 'text', text }] };
    if (messageID)
        body.messageID = messageID;
    if (agent)
        body.agent = agent;
    const identity = modelIdentity(model);
    if (identity)
        body.model = identity;
    if (variant)
        body.variant = variant;
    if (tools && Object.keys(tools).length)
        body.tools = tools;
    if (format)
        body.format = format;
    if (typeof edge?.session?.promptAsync === 'function') {
        const result = await awaitPromptAsyncAck(signal => edge.session.promptAsync({ path: { id: sessionID }, body, signal, throwOnError: true }), `session.prompt_async:${sessionID}`, ackTimeoutMs);
        assertMutationAccepted(result, `session.prompt_async:${sessionID}`);
        return;
    }
    if (typeof edge?.session?.prompt === 'function') {
        const result = await edge.session.prompt({ path: { id: sessionID }, body, throwOnError: true });
        assertMutationAccepted(result, `session.prompt:${sessionID}`);
        return;
    }
    throw new Error('OpenCode session prompt API unavailable');
}
function messageReadError(value) {
    const error = value?.error;
    if (!error)
        return undefined;
    const name = typeof error?.name === 'string' ? error.name : 'OpenCodeMessageReadError', data = error?.data && typeof error.data === 'object' ? error.data : error, detail = String(data?.message ?? error?.message ?? name).slice(0, 1200);
    return new Error(`${name}: ${detail}`);
}
function structuredMessageCompatibilityError(error) { return /Expected\s+OutputFormatJsonSchema|OutputFormatJsonSchema.*(?:expected|decode|schema)|structured.*output.*format/i.test(error.message); }
function normalizeMessageList(response) { const payload = dataOf(response); if (Array.isArray(payload))
    return payload; return Array.isArray(payload?.data) ? payload.data : []; }
async function listMessagesV2(sessionID, limit, endpoint) {
    if (!endpoint.serverUrl)
        throw new Error('OpenCode V2 message-read endpoint unavailable');
    const client = createOpenCodeV2Client({ baseUrl: endpoint.serverUrl, directory: endpoint.directory, headers: lifecycleHeaders(endpoint.directory) }), session = client?.v2?.session;
    if (!session || typeof session.messages !== 'function')
        throw new Error('OpenCode canonical V2 session.messages unavailable');
    const response = await session.messages({ sessionID, limit });
    const error = messageReadError(response);
    if (error)
        throw error;
    return normalizeMessageList(response);
}
export async function listMessages(client, sessionID, limit = 20, endpoint = {}) {
    const edge = client;
    if (typeof edge?.session?.messages !== 'function')
        return endpoint.serverUrl ? listMessagesV2(sessionID, limit, endpoint) : [];
    const response = await edge.session.messages({ path: { id: sessionID }, query: { limit } });
    const error = messageReadError(response);
    if (error) {
        if (endpoint.serverUrl && structuredMessageCompatibilityError(error))
            return listMessagesV2(sessionID, limit, endpoint);
        throw error;
    }
    return normalizeMessageList(response);
}
export async function sendSyntheticContinuation(client, sessionID, text, metadata, ackTimeoutMs = HOST_MUTATION_ACK_TIMEOUT_MS) {
    const edge = client, body = { parts: [{ type: 'text', text, synthetic: true, metadata }], noReply: false };
    if (typeof edge?.session?.promptAsync === 'function') {
        const result = await awaitPromptAsyncAck(signal => edge.session.promptAsync({ path: { id: sessionID }, body, signal, throwOnError: true }), `session.prompt_async:${sessionID}`, ackTimeoutMs);
        assertMutationAccepted(result, `session.prompt_async:${sessionID}`);
        return true;
    }
    if (typeof edge?.session?.prompt === 'function') {
        const result = await edge.session.prompt({ path: { id: sessionID }, body, throwOnError: true });
        assertMutationAccepted(result, `session.prompt:${sessionID}`);
        return true;
    }
    return false;
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
export function sessionRuntimeStatusFromStatus(value, sessionID) {
    const statusMap = dataOf(value);
    if (!statusMap || typeof statusMap !== 'object' || Array.isArray(statusMap))
        return 'unknown';
    const status = statusMap[sessionID];
    // Current OpenCode status-map contract omits idle sessions; absence is canonical idle.
    if (status === undefined)
        return 'idle';
    if (!status || typeof status !== 'object')
        return 'unknown';
    const type = String(status.type ?? '').toLowerCase();
    return type === 'idle' || type === 'busy' || type === 'retry' ? type : 'unknown';
}
function sessionIdleFromStatus(value, sessionID) { const status = sessionRuntimeStatusFromStatus(value, sessionID); return status === 'idle' ? true : status === 'busy' || status === 'retry' ? false : undefined; }
export async function readSessionRuntimeStatus(client, sessionID, endpoint = {}) {
    const edge = client, call = edge?.session?.status;
    if (typeof call === 'function') {
        try {
            const status = sessionRuntimeStatusFromStatus(await call.call(edge.session), sessionID);
            if (status !== 'unknown')
                return status;
        }
        catch { }
    }
    if (endpoint.serverUrl) {
        try {
            const base = endpoint.serverUrl.replace(/\/$/, ''), url = new URL(`${base}/session/status`);
            if (endpoint.directory)
                url.searchParams.set('directory', endpoint.directory);
            const response = await fetch(url, { method: 'GET', headers: lifecycleHeaders(), signal: AbortSignal.timeout(5000) });
            if (!response.ok)
                return 'unknown';
            return sessionRuntimeStatusFromStatus(await response.json(), sessionID);
        }
        catch {
            return 'unknown';
        }
    }
    return 'unknown';
}
async function serverPendingPermissionForSession(base, sessionID, directory) {
    try {
        const url = new URL(`${base}/permission`);
        if (directory)
            url.searchParams.set('directory', directory);
        const response = await fetch(url, { method: 'GET', headers: lifecycleHeaders(directory), signal: AbortSignal.timeout(5000) });
        if (!response.ok)
            return undefined;
        const pending = dataOf(await response.json());
        if (!Array.isArray(pending))
            return undefined;
        return pending.some(item => String(item?.sessionID ?? item?.sessionId ?? '') === sessionID);
    }
    catch {
        return undefined;
    }
}
async function serverAbortSettled(base, sessionID, directory) {
    const pending = await serverPendingPermissionForSession(base, sessionID, directory);
    return pending !== true;
}
async function reconcileServerAbort(base, sessionID, directory) {
    try {
        const response = await fetch(`${base}/session/status`, { method: 'GET', headers: lifecycleHeaders(directory), signal: AbortSignal.timeout(5000) });
        if (!response.ok)
            return false;
        if (sessionIdleFromStatus(await response.json(), sessionID) !== true)
            return false;
        return serverAbortSettled(base, sessionID, directory);
    }
    catch {
        return false;
    }
}
async function reconcileClientAbort(edge, sessionID) {
    if (typeof edge?.session?.status !== 'function')
        return false;
    try {
        return sessionIdleFromStatus(await edge.session.status(), sessionID) === true;
    }
    catch {
        return false;
    }
}
export async function abortSession(client, sessionID, endpoint = {}) {
    const edge = client;
    // The plugin-injected SDK is the canonical in-process host boundary. Prefer its
    // single abort mutation whenever present; a handcrafted HTTP call back into the
    // same OpenCode server can self-deadlock while the current plugin request owns
    // instance/session execution. Never replay an ambiguous SDK abort through HTTP.
    if (typeof edge?.session?.abort === 'function') {
        try {
            const result = await edge.session.abort({ path: { id: sessionID } });
            if ((result === true || dataOf(result) === true) && !(result && typeof result === 'object' && result.error))
                return 'client';
        }
        catch { }
        return await reconcileClientAbort(edge, sessionID) ? 'client-reconciled' : 'unavailable';
    }
    if (!endpoint.serverUrl)
        return 'unavailable';
    const base = endpoint.serverUrl.replace(/\/$/, '');
    try {
        const response = await fetch(`${base}/session/${encodeURIComponent(sessionID)}/abort`, { method: 'POST', headers: lifecycleHeaders(endpoint.directory), signal: AbortSignal.timeout(5000) });
        if (response.ok) {
            try {
                if (await response.json() === true)
                    return await serverAbortSettled(base, sessionID, endpoint.directory) ? 'server' : 'unavailable';
            }
            catch { }
        }
    }
    catch { }
    return await reconcileServerAbort(base, sessionID, endpoint.directory) ? 'server-reconciled' : 'unavailable';
}
export async function listProviders(client) { const edge = client; if (typeof edge?.provider?.list === 'function')
    return dataOf(await edge.provider.list()); return undefined; }
export async function listAvailableModels(endpoint = {}) {
    if (!endpoint.serverUrl)
        return undefined;
    try {
        const client = createOpenCodeV2Client({ baseUrl: endpoint.serverUrl, directory: endpoint.directory, headers: lifecycleHeaders(endpoint.directory) }), model = client?.v2?.model;
        if (!model || typeof model.list !== 'function')
            return undefined;
        const payload = dataOf(await model.list(endpoint.directory ? { location: { directory: endpoint.directory } } : undefined));
        if (Array.isArray(payload))
            return payload;
        return Array.isArray(payload?.data) ? payload.data : undefined;
    }
    catch {
        return undefined;
    }
}
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
export function lastAssistantStructured(messages) { for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i], info = msg?.info ?? msg?.message ?? msg;
    if (info?.role && info.role !== 'assistant')
        continue;
    if (info && Object.prototype.hasOwnProperty.call(info, 'structured'))
        return info.structured;
} return undefined; }
export function lastIncompleteAssistantTurn(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i], info = msg?.info ?? msg?.message ?? msg;
        if (info?.role && info.role !== 'assistant')
            continue;
        const completed = Number(info?.time?.completed);
        if (Number.isFinite(completed) && completed >= 0)
            return undefined;
        const created = Number(info?.time?.created);
        if (!Number.isFinite(created) || created < 0)
            return undefined;
        const parts = msg?.parts ?? info?.parts ?? [], output = Number(info?.tokens?.output ?? 0), reasoning = Number(info?.tokens?.reasoning ?? 0), empty = parts.length === 0 && (!Number.isFinite(output) || output === 0) && (!Number.isFinite(reasoning) || reasoning === 0), messageID = info?.id ?? msg?.id, parent = info?.parentID ?? info?.parentId;
        return { ...(messageID ? { message_id: String(messageID) } : {}), ...(typeof parent === 'string' && parent ? { parent_id: parent } : {}), created_at: created, empty };
    }
    return undefined;
}
export function lastMeaningfulAssistantActivity(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i], info = msg?.info ?? msg?.message ?? msg;
        if (info?.role && info.role !== 'assistant')
            continue;
        const completed = Number(info?.time?.completed);
        if (!Number.isFinite(completed) || completed < 0)
            continue;
        const parts = msg?.parts ?? info?.parts ?? [], toolCalls = parts.filter((p) => p?.type === 'tool').length, textChars = parts.filter((p) => p?.type === 'text' && typeof p.text === 'string').reduce((n, p) => n + p.text.trim().length, 0);
        const output = Number(info?.tokens?.output ?? 0), reasoning = Number(info?.tokens?.reasoning ?? 0), outputTokens = Number.isFinite(output) && output > 0 ? output : 0, reasoningTokens = Number.isFinite(reasoning) && reasoning > 0 ? reasoning : 0;
        if (!toolCalls && !textChars && !outputTokens && !reasoningTokens)
            continue;
        const messageID = info?.id ?? msg?.id;
        return { ...(messageID ? { message_id: String(messageID) } : {}), observed_at: completed, output_tokens: outputTokens, reasoning_tokens: reasoningTokens, tool_calls: toolCalls, text_chars: textChars };
    }
    return undefined;
}
export function assistantErrorEvidence(value) { if (value == null)
    return undefined; if (typeof value === 'string') {
    const message = value.trim();
    return message ? { message } : undefined;
} if (typeof value !== 'object')
    return undefined; const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : undefined, data = value.data && typeof value.data === 'object' ? value.data : value, messageCandidates = [value.message, data?.message, value.error?.message, value.cause?.message], message = messageCandidates.find(x => typeof x === 'string' && x.trim())?.trim(), isRetryable = typeof data?.isRetryable === 'boolean' ? data.isRetryable : undefined, statusCode = Number.isInteger(data?.statusCode) && data.statusCode >= 0 ? data.statusCode : undefined; if (!message && !name)
    return undefined; return { ...(name ? { name } : {}), message: message ?? name, ...(isRetryable !== undefined ? { isRetryable } : {}), ...(statusCode !== undefined ? { statusCode } : {}) }; }
export function lastAssistantError(messages) { for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i], info = msg?.info ?? msg?.message ?? msg;
    if (info?.role && info.role !== 'assistant')
        continue;
    return assistantErrorEvidence(info?.error ?? msg?.error);
} return undefined; }
export function lastAssistantModel(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i], info = msg?.info ?? msg?.message ?? msg;
        if (info?.role && info.role !== 'assistant')
            continue;
        const provider = info?.providerID ?? info?.providerId ?? info?.model?.providerID ?? info?.model?.providerId ?? info?.provider;
        const modelID = info?.modelID ?? info?.modelId ?? info?.model?.modelID ?? info?.model?.modelId ?? info?.model?.id ?? (typeof info?.model === 'string' ? info.model : undefined);
        const canonical = provider && modelID ? `${String(provider)}/${String(modelID)}` : (typeof modelID === 'string' && modelID.includes('/') ? modelID : undefined);
        if (canonical) {
            const created = Number(info?.time?.created), parent = info?.parentID ?? info?.parentId;
            return { model: canonical, variant: info?.variant ?? info?.model?.variant, message_id: info?.id ?? msg?.id, ...(typeof parent === 'string' && parent ? { parent_id: parent } : {}), ...(Number.isFinite(created) && created >= 0 ? { created_at: created } : {}) };
        }
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
