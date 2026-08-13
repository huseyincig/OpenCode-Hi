import { approvePendingAuthority, resolveUncertainAuthority } from '../runtime/safety/authority.js';
import { isHiPrimaryRole } from '../runtime/roles/catalog.js';
function isHiInternal(output) { const parts = output?.parts ?? output?.message?.parts ?? []; return parts.some((p) => p?.type === 'text' && (p?.metadata?.hiInternalContinuation === true || (p?.synthetic === true && p?.metadata?.hiInternalContinuation))); }
function extractText(value) { const parts = value?.parts ?? value?.message?.parts ?? []; return parts.filter((p) => p?.type === 'text' && typeof p.text === 'string').map((p) => p.text).join('\n').trim(); }
function normalizeNativeUserText(text) {
    const trimmed = text.trim();
    if (trimmed.length >= 2 && trimmed[0] === trimmed.at(-1)) {
        if (trimmed[0] === '\"') {
            try {
                const parsed = JSON.parse(trimmed);
                if (typeof parsed === 'string')
                    return parsed.trim();
            }
            catch { }
        }
        if (trimmed[0] === "'")
            return trimmed.slice(1, -1).trim();
    }
    return trimmed;
}
function extractNativeUserText(input, output) {
    // OpenCode 1.18.x chat.message exposes the current user message on output.message/output.parts.
    // CLI `opencode run` may wrap the entire text in one JSON-style quote layer; normalize only that outer layer.
    // Keep input.message only as a compatibility fallback for older hosts and unit fixtures.
    if (output?.message?.role === 'user' || output?.role === 'user')
        return normalizeNativeUserText(extractText(output));
    const legacy = input?.message;
    if (legacy?.role === 'user' || legacy?.role === undefined)
        return normalizeNativeUserText(extractText(legacy));
    return '';
}
export function createChatMessageHook(store, onFollowupPending) {
    return async (input, output) => {
        const sid = input?.sessionID;
        if (!sid)
            return;
        if (isHiInternal(output))
            return;
        const userText = extractNativeUserText(input, output);
        if (!userText)
            return;
        const agent = typeof input?.agent === 'string' ? input.agent : '';
        const observedPrimary = isHiPrimaryRole(agent) ? agent : undefined;
        if (agent && !observedPrimary)
            return;
        const existing = store.get(sid);
        if (existing && observedPrimary)
            store.bindObservedPrimary(sid, observedPrimary);
        // Exact authority-response tokens remain a separate deterministic safety protocol.
        if (existing && resolveUncertainAuthority(existing, userText))
            return;
        if (existing && approvePendingAuthority(existing, userText)) {
            store.resume(sid, 'authority-approved');
            return;
        }
        if (!existing || existing.status === 'completed' || existing.status === 'failed') {
            store.start(sid, userText, observedPrimary);
            return;
        }
        // A previously stopped mission does not infer "resume" from prose here. Start a new provisional
        // mission; Human Decision/authority controls own explicit resurrection semantics.
        if (existing.status === 'stopped' || existing.user_interrupted) {
            store.start(sid, userText, observedPrimary);
            return;
        }
        if (existing.semantic_assessment.status === 'pending')
            return;
        if (['active', 'waiting-user'].includes(existing.status)) {
            store.beginFollowupSemanticAssessment(sid, userText);
            await onFollowupPending?.(sid, userText);
        }
    };
}
