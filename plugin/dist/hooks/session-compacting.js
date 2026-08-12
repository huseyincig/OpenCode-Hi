import { compactMissionContext } from '../runtime/state/snapshot.js';
export function createSessionCompactingHook(store, background) { return async (input, output) => { const sessionID = input?.sessionID; if (!sessionID || !Array.isArray(output?.context))
    return; const child = background?.list().find(w => w.session_id === sessionID), mission = child ? store.get(child.parent_session_id) : store.get(sessionID); if (!mission)
    return; output.context.push(compactMissionContext(mission, child)); }; }
