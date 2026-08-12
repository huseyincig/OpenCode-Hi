import { appendLedger } from '../ledger/ledger.js';
export async function dispatchContinuation(client, mission, prompt, reason) {
    const now = Date.now(), generation = mission.generation;
    if (mission.user_interrupted || mission.status === 'stopped') {
        appendLedger(mission, 'continuation.rejected', { payload: { reason: 'user-interrupted', generation } });
        return false;
    }
    if (mission.continuation_active || mission.active_action_id || (mission.suppress_until ?? 0) > now || (mission.continuation_lock_until ?? 0) > now)
        return false;
    const fn = typeof client?.session?.promptAsync === 'function' ? client.session.promptAsync.bind(client.session) : typeof client?.session?.prompt_async === 'function' ? client.session.prompt_async.bind(client.session) : typeof client?.session?.prompt === 'function' ? client.session.prompt.bind(client.session) : undefined;
    if (!fn) {
        appendLedger(mission, 'continuation.unavailable', { payload: { reason: 'host-continuation-api-missing' } });
        return false;
    }
    const iteration = mission.iteration + 1, actionID = `continue:${mission.mission_id}:${generation}:${iteration}:${now.toString(36)}`;
    mission.continuation_active = true;
    mission.active_action_id = actionID;
    mission.continuation_lock_until = now + 2500;
    mission.suppress_until = now + 400;
    mission.last_continuation_at = now;
    mission.iteration = iteration;
    mission.continuation_reason = reason;
    mission.last_action_id = actionID;
    appendLedger(mission, 'continuation', { payload: { reason, iteration, generation, action_id: actionID } });
    try {
        await fn({ path: { id: mission.session_id }, body: { parts: [{ type: 'text', text: prompt, synthetic: true, metadata: { hiInternalContinuation: true, reason, generation, actionID } }], noReply: false } });
        if (mission.generation !== generation) {
            appendLedger(mission, 'continuation.stale-completion', { payload: { started_generation: generation, current_generation: mission.generation, action_id: actionID } });
            return false;
        }
        if (mission.active_action_id !== actionID) {
            appendLedger(mission, 'continuation.stale-action-completion', { payload: { action_id: actionID, current_action_id: mission.active_action_id ?? null, generation } });
            return false;
        }
        mission.continuation_failure_count = 0;
        mission.last_continuation_failure_at = undefined;
        return true;
    }
    catch (error) {
        if (mission.generation === generation && mission.active_action_id === actionID) {
            mission.continuation_failure_count = (mission.continuation_failure_count ?? 0) + 1;
            mission.last_continuation_failure_at = Date.now();
            if (mission.iteration === iteration)
                mission.iteration = Math.max(0, mission.iteration - 1);
        }
        appendLedger(mission, 'continuation.failed', { payload: { error: String(error), generation, action_id: actionID, runtime_failures: mission.continuation_failure_count ?? 0 } });
        return false;
    }
    finally {
        if (mission.generation === generation && mission.active_action_id === actionID) {
            mission.continuation_active = false;
            mission.active_action_id = undefined;
        }
    }
}
