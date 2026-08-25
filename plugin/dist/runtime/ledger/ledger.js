import { redactDurableText } from '../privacy/boundary.js';
import { durableProgressKey } from '../liveness/progress-classifier.js';
const MAX_EVENTS = 200;
const MAX_STRING = 600;
const MAX_ARRAY = 24;
const MAX_KEYS = 32;
const MAX_DEPTH = 3;
const CRITICAL = new Set(['mission.provisional', 'semantic.assessed', 'mission.completed', 'mission.stopped', 'user.action.required', 'authority.execution.uncertain']);
function id() { return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }
function bounded(value, depth = 0) {
    if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean')
        return value;
    if (typeof value === 'string') {
        const safe = redactDurableText(value);
        return safe.length <= MAX_STRING ? safe : `${safe.slice(0, MAX_STRING)}…[truncated]`;
    }
    if (depth >= MAX_DEPTH)
        return '[bounded]';
    if (Array.isArray(value))
        return value.slice(0, MAX_ARRAY).map(v => bounded(v, depth + 1));
    if (typeof value === 'object') {
        const out = {};
        let n = 0;
        for (const [k, v] of Object.entries(value)) {
            if (n++ >= MAX_KEYS)
                break;
            out[k.slice(0, 120)] = bounded(v, depth + 1);
        }
        return out;
    }
    return redactDurableText(String(value)).slice(0, MAX_STRING);
}
function trimLedger(mission) {
    const events = mission.execution.ledger;
    while (events.length > MAX_EVENTS) {
        const protectedProgress = [...events].reverse().find(e => Boolean(durableProgressKey(e, mission.continuation.generation)))?.id;
        const removable = events.findIndex((e, i) => i < events.length - 1 && !CRITICAL.has(e.type) && e.id !== protectedProgress);
        events.splice(removable >= 0 ? removable : 0, 1);
    }
}
export function appendLedger(mission, type, detail = {}) {
    const payload = detail.payload === undefined ? undefined : bounded(detail.payload);
    const event = { id: id(), at: Date.now(), mission_id: mission.identity.mission_id, type: type.slice(0, 160), task_id: detail.task_id?.slice(0, 160), worker_id: detail.worker_id?.slice(0, 160), payload };
    mission.execution.ledger.push(event);
    trimLedger(mission);
    mission.identity.updated_at = event.at;
    return event;
}
