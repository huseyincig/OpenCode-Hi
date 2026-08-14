export const TEAM_CONTRACT_STATUSES = ['active', 'shutdown'];
const KEYS = new Set(['team_id', 'mission_id', 'generation', 'member_task_refs', 'member_role_refs', 'capacity', 'status', 'created_at', 'shutdown_at']);
function record(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function finite(v) { return typeof v === 'number' && Number.isFinite(v); }
function strings(v) { return Array.isArray(v) && v.every(x => typeof x === 'string' && Boolean(x)); }
export function isTeamContract(v) {
    if (!record(v) || !Object.keys(v).every(k => KEYS.has(k)))
        return false;
    if (typeof v.team_id !== 'string' || !/^team_[a-z0-9_]+$/.test(v.team_id) || typeof v.mission_id !== 'string' || !v.mission_id)
        return false;
    if (!finite(v.generation) || v.generation < 1 || !strings(v.member_task_refs) || !strings(v.member_role_refs))
        return false;
    if (v.member_task_refs.length !== v.member_role_refs.length || v.member_task_refs.length < 2)
        return false;
    if (new Set(v.member_task_refs).size !== v.member_task_refs.length)
        return false;
    if (!finite(v.capacity) || v.capacity < 2 || v.capacity < v.member_task_refs.length)
        return false;
    if (!TEAM_CONTRACT_STATUSES.includes(v.status) || !finite(v.created_at) || v.created_at <= 0)
        return false;
    if (v.status === 'active' && v.shutdown_at !== undefined)
        return false;
    if (v.status === 'shutdown' && (!finite(v.shutdown_at) || v.shutdown_at < v.created_at))
        return false;
    return true;
}
