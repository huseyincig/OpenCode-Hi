import { assistantErrorEvidence, eventSessionID, lastAssistantError, lastAssistantModel, lastAssistantStructured, lastAssistantUsage } from './client-adapter.js';
const MAP = {
    'session.idle': 'session-idle', 'session.error': 'session-error', 'session.deleted': 'session-deleted', 'session.status': 'session-status', 'session.diff': 'session-diff', 'session.compacted': 'session-compacted', 'message.updated': 'assistant-message-updated',
    'todo.updated': 'todo-updated', 'permission.asked': 'permission-asked', 'permission.replied': 'permission-replied', 'file.edited': 'file-edited', 'file.watcher.updated': 'file-watcher-updated',
    'lsp.client.diagnostics': 'lsp-diagnostics', 'installation.updated': 'installation-updated',
};
export function eventStatus(event) { const raw = event.properties?.status ?? event.properties?.state; if (typeof raw === 'string')
    return raw; if (raw && typeof raw === 'object') {
    const nested = raw.type ?? raw.status ?? raw.state;
    if (typeof nested === 'string')
        return nested;
} return 'unknown'; }
function collectStrings(value, out, depth = 0) {
    if (depth > 5 || value == null)
        return;
    if (typeof value === 'string') {
        if (/[\\/]/.test(value) || /\.[A-Za-z0-9]{1,8}$/.test(value))
            out.add(value);
        return;
    }
    if (Array.isArray(value)) {
        for (const x of value)
            collectStrings(x, out, depth + 1);
        return;
    }
    if (typeof value === 'object')
        for (const [k, v] of Object.entries(value))
            if (['file', 'path', 'filePath', 'filename', 'files', 'paths', 'diff', 'changes'].includes(k) || depth < 2)
                collectStrings(v, out, depth + 1);
}
export function eventFilePaths(event) { const out = new Set(); collectStrings(event.properties, out); return [...out].filter(x => !x.includes('\n')).slice(0, 200); }
export function permissionReply(event) { const v = String(event.properties?.response ?? event.properties?.decision ?? event.properties?.reply ?? '').toLowerCase(); return v.includes('always') ? 'always' : v.includes('once') || v.includes('allow') || v.includes('approve') ? 'once' : v.includes('deny') || v.includes('reject') ? 'reject' : 'unknown'; }
export function permissionDecision(event) { const v = permissionReply(event); return v === 'once' || v === 'always' ? 'allow' : v === 'reject' ? 'deny' : 'unknown'; }
export function permissionPatterns(event) { const p = event.properties ?? {}; const raw = p.patterns ?? p.always ?? p.permission?.patterns ?? p.request?.patterns; return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : []; }
export function permissionEventID(event) { const p = event.properties ?? {}; const raw = p.id ?? p.permissionID ?? p.permissionId ?? p.requestID ?? p.requestId ?? p.permission?.id ?? p.request?.id; return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined; }
export function normalizeOpenCodeEvent(event) { const rawType = String(event?.type ?? ''), base = { kind: MAP[rawType] ?? 'unknown', rawType, sessionID: eventSessionID(event), properties: event?.properties ?? {}, filePaths: [], status: 'unknown' }; base.filePaths = eventFilePaths(base); base.status = eventStatus(base); if (base.kind === 'session-error')
    base.error = assistantErrorEvidence(base.properties?.error); if (base.kind === 'assistant-message-updated') {
    const info = base.properties?.info, one = info ? [{ info, parts: [] }] : [];
    if (info?.role === 'assistant')
        base.assistant = { text: '', structured: lastAssistantStructured(one), model: lastAssistantModel(one), usage: lastAssistantUsage(one), error: lastAssistantError(one) };
} const id = permissionEventID(base), reply = permissionReply(base), decision = permissionDecision(base), patterns = permissionPatterns(base), command = typeof base.properties?.metadata?.command === 'string' ? base.properties.metadata.command : typeof base.properties?.request?.metadata?.command === 'string' ? base.properties.request.metadata.command : undefined; if (id || patterns.length || base.kind === 'permission-asked' || base.kind === 'permission-replied')
    base.permission = { id, reply, decision, patterns, command }; return base; }
