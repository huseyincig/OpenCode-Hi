import { dataOf, modelIdentity } from './client-adapter.js';
function fn(root, ...names) {
    for (const name of names) {
        const v = root?.[name];
        if (typeof v === 'function')
            return v.bind(root);
    }
    return undefined;
}
export class NativeOpenCodeAdapter {
    client;
    constructor(client) {
        this.client = client;
    }
    has(name) {
        const s = this.client?.session;
        switch (name) {
            case 'session-create': return Boolean(fn(s, 'create'));
            case 'prompt-async': return Boolean(fn(s, 'promptAsync', 'prompt_async'));
            case 'prompt-sync': return Boolean(fn(s, 'prompt'));
            case 'abort': return Boolean(fn(s, 'abort'));
            case 'status': return Boolean(fn(s, 'status', 'getStatus'));
            case 'children': return Boolean(fn(s, 'children', 'child', 'listChildren'));
            case 'todo': return Boolean(fn(s, 'todo', 'todos'));
            case 'diff': return Boolean(fn(s, 'diff'));
            case 'fork': return Boolean(fn(s, 'fork'));
            case 'summarize': return Boolean(fn(s, 'summarize', 'summary'));
            case 'revert': return Boolean(fn(s, 'revert'));
            case 'unrevert': return Boolean(fn(s, 'unrevert'));
            case 'provider-inventory': return Boolean(fn(this.client?.provider, 'list') || fn(this.client?.config, 'providers'));
            case 'structured-log': return Boolean(fn(this.client?.app, 'log'));
        }
    }
    async status(sessionID) { const call = fn(this.client?.session, 'status', 'getStatus'); return call ? dataOf(await call({ path: { id: sessionID } })) : undefined; }
    async children(sessionID) { const call = fn(this.client?.session, 'children', 'child', 'listChildren'); const value = call ? dataOf(await call({ path: { id: sessionID } })) : []; return Array.isArray(value) ? value : (Array.isArray(value?.children) ? value.children : []); }
    async todo(sessionID) { const call = fn(this.client?.session, 'todo', 'todos'); const value = call ? dataOf(await call({ path: { id: sessionID } })) : []; return Array.isArray(value) ? value : (Array.isArray(value?.todos) ? value.todos : []); }
    async diff(sessionID) { const call = fn(this.client?.session, 'diff'); return call ? dataOf(await call({ path: { id: sessionID } })) : undefined; }
    async fork(sessionID, title) { const call = fn(this.client?.session, 'fork'); if (!call)
        throw new Error('OpenCode session.fork unavailable'); return dataOf(await call({ path: { id: sessionID }, body: title ? { title } : {} })); }
    async summarize(sessionID) { const call = fn(this.client?.session, 'summarize', 'summary'); if (!call)
        throw new Error('OpenCode session.summarize unavailable'); return dataOf(await call({ path: { id: sessionID } })); }
    async revert(sessionID, messageID) { const call = fn(this.client?.session, 'revert'); if (!call)
        throw new Error('OpenCode session.revert unavailable'); return dataOf(await call({ path: { id: sessionID }, body: messageID ? { messageID } : {} })); }
    async unrevert(sessionID) { const call = fn(this.client?.session, 'unrevert'); if (!call)
        throw new Error('OpenCode session.unrevert unavailable'); return dataOf(await call({ path: { id: sessionID } })); }
    async prompt(sessionID, text, agent, model, variant) {
        const body = { parts: [{ type: 'text', text }] };
        if (agent)
            body.agent = agent;
        const identity = modelIdentity(model);
        if (identity)
            body.model = identity;
        if (variant)
            body.variant = variant;
        const call = fn(this.client?.session, 'promptAsync', 'prompt_async') ?? fn(this.client?.session, 'prompt');
        if (!call)
            throw new Error('OpenCode session prompt API unavailable');
        await call({ path: { id: sessionID }, body });
    }
    async version() { const candidates = [[this.client?.app, ['version']], [this.client?.server, ['version']], [this.client?.app, ['info']]]; for (const [root, names] of candidates) {
        const call = fn(root, ...names);
        if (!call)
            continue;
        try {
            const value = dataOf(await call({}));
            const raw = typeof value === 'string' ? value : value?.version ?? value?.opencodeVersion;
            if (raw)
                return String(raw);
        }
        catch { }
    } return process.env.OPENCODE_VERSION ?? process.env.OPENCODE_CLI_VERSION; }
    async snapshot(sessionID) {
        const [status, children, todo, diff] = await Promise.allSettled([this.status(sessionID), this.children(sessionID), this.todo(sessionID), this.diff(sessionID)]);
        return { status: status.status === 'fulfilled' ? status.value : undefined, children: children.status === 'fulfilled' ? children.value : undefined, todo: todo.status === 'fulfilled' ? todo.value : undefined, diff: diff.status === 'fulfilled' ? diff.value : undefined };
    }
}
export function effectiveConfigView(hostConfig) { return hostConfig && typeof hostConfig === 'object' ? hostConfig : {}; }
export function configuredSubagentDepth(hostConfig) {
    const raw = hostConfig?.subagent_depth;
    return Number.isFinite(Number(raw)) ? Number(raw) : undefined;
}
function addStrings(target, value) { if (typeof value === 'string' && value.trim())
    target.add(value.trim());
else if (Array.isArray(value))
    for (const x of value)
        addStrings(target, x); }
export function providerPolicyView(hostConfig) {
    const cfg = effectiveConfigView(hostConfig), allowed = new Set(), denied = new Set(), source = [];
    addStrings(allowed, cfg.enabled_providers);
    if (allowed.size)
        source.push('enabled_providers');
    addStrings(denied, cfg.disabled_providers);
    if (denied.size)
        source.push('disabled_providers');
    const use = cfg?.policy?.provider?.use ?? cfg?.policies?.provider?.use;
    if (use && typeof use === 'object' && !Array.isArray(use)) {
        for (const [provider, decision] of Object.entries(use)) {
            const d = typeof decision === 'string' ? decision : decision?.action ?? decision?.permission;
            if (d === 'deny')
                denied.add(provider);
            else if (d === 'allow')
                allowed.add(provider);
        }
        source.push('policy.provider.use');
    }
    return { allowed, denied, source };
}
export function configuredRemoteInstructions(hostConfig) {
    const cfg = effectiveConfigView(hostConfig), raw = cfg?.instructions, items = Array.isArray(raw) ? raw : (typeof raw === 'string' ? [raw] : []);
    return items.filter((x) => typeof x === 'string' && /^https?:\/\//i.test(x)).map(String);
}
export function configuredPluginSpecs(hostConfig) {
    const raw = effectiveConfigView(hostConfig)?.plugin;
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string').map(String) : [];
}
export function configuredShareMode(hostConfig) { return effectiveConfigView(hostConfig)?.share; }
