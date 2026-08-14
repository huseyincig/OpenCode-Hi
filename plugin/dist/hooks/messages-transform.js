import { ownershipContract } from '../runtime/skills/methodology.js';
import { pruneDuplicateProviderToolOutputs } from '../runtime/context/provider-duplicate-pruning.js';
const NATIVE_HOUSEKEEPING_AGENTS = new Set(['title', 'summary', 'compaction']);
function isNativeHousekeeping(input) { return NATIVE_HOUSEKEEPING_AGENTS.has(String(input?.agent ?? input?.agentName ?? '').toLowerCase()); }
function sessionID(input) { return input?.sessionID ?? input?.sessionId ?? input?.session?.id; }
function textPartLike(ref, text) { return ref && typeof ref === 'object' ? { ...ref, type: 'text', text } : { type: 'text', text }; }
function containsContract(parts, needle) { return parts.some(p => p?.type === 'text' && typeof p.text === 'string' && p.text.includes(needle)); }
export function createMessagesTransformHook(store, background) {
    return async (input, output) => {
        const sid = sessionID(input);
        if (!sid || isNativeHousekeeping(input) || !Array.isArray(output?.messages) || !output.messages.length)
            return;
        output.messages = pruneDuplicateProviderToolOutputs(output.messages).messages;
        const firstUserIndex = output.messages.findIndex((m) => m?.info?.role === 'user'), firstUser = firstUserIndex >= 0 ? output.messages[firstUserIndex] : undefined;
        if (!firstUser || !Array.isArray(firstUser.parts))
            return;
        if (containsContract(firstUser.parts, 'Hi CONTROL-PLANE CONTRACT') || containsContract(firstUser.parts, 'Hi CHILD CONTROL-PLANE CONTRACT'))
            return;
        const child = background.list().find(w => w.session_id === sid);
        const mission = child ? store.get(child.parent_session_id) : store.get(sid);
        if (!mission)
            return;
        if (child && ((child.parent_mission_id !== undefined && child.parent_mission_id !== mission.identity.mission_id) || (child.generation_at_spawn !== undefined && child.generation_at_spawn !== mission.continuation.generation)))
            return;
        const worker = child ? mission.execution.workers.find(w => w.id === child.id) : undefined;
        const contract = ownershipContract(child ? 'child' : 'parent', worker?.selected_methodologies ?? []);
        const ref = firstUser.parts[firstUser.parts.length - 1] ?? firstUser.parts[0], projectedUser = { ...firstUser, parts: [...firstUser.parts, textPartLike(ref, contract)] };
        output.messages = [...output.messages];
        output.messages[firstUserIndex] = projectedUser;
    };
}
