import { abortSession, createChildSession, readSessionRuntimeStatus, sendPromptAsync } from './client-adapter.js';
import { NativeOpenCodeAdapter } from './native-adapter.js';
export function createOpenCodeChildSessionPort(client, lifecycle = {}) {
    const native = new NativeOpenCodeAdapter(client);
    return {
        capabilities: {
            create: native.has('session-create'), prompt: native.has('prompt-async') || native.has('prompt-sync'), abort: Boolean(lifecycle.serverUrl) || native.has('abort'), status: Boolean(lifecycle.serverUrl) || native.has('status'),
            diff: native.has('diff'), summarize: native.has('summarize'), fork: native.has('fork'),
        },
        async create(request) {
            const { parentSessionID, title, role, model, variant, workspace, forkFromSession } = request;
            const child = await createChildSession(client, parentSessionID, title, role, model, variant, workspace?.workspaceID, lifecycle);
            return { child, fork: { requested: Boolean(forkFromSession), nativeAvailable: Boolean(forkFromSession) && native.has('fork'), used: false, reason: forkFromSession ? 'native fork cannot set specialist agent; created isolated child instead' : undefined } };
        },
        prompt: (sessionID, text, role, model, variant, tools, messageID) => sendPromptAsync(client, sessionID, text, role, model, variant, tools, undefined, messageID),
        abort: (sessionID) => abortSession(client, sessionID, lifecycle),
        status: (sessionID) => readSessionRuntimeStatus(client, sessionID, lifecycle),
        diff: (sessionID) => native.diff(sessionID),
        summarize: (sessionID) => native.summarize(sessionID),
    };
}
