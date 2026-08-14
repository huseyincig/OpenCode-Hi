export const ISOLATION_STRATEGIES = ['none', 'git-worktree'];
export const WORKSPACE_LEASE_STATUSES = ['ACTIVE', 'RECONCILING', 'CLOSED', 'ORPHANED'];
export const WORKSPACE_CLEANUP_STATES = ['ACTIVE', 'CLEANUP_PENDING', 'CLEANED', 'QUARANTINED'];
const DECISION_KEYS = new Set(['required', 'reason', 'strategy', 'scope', 'requested_by']);
const LEASE_KEYS = new Set(['lease_id', 'mission_id', 'task_id', 'repository_root', 'base_ref', 'workspace_path', 'host_workspace_id', 'branch', 'created_at', 'status', 'cleanup_state', 'source_baseline']);
const STRATEGIES = new Set(ISOLATION_STRATEGIES), STATUSES = new Set(WORKSPACE_LEASE_STATUSES), CLEANUP = new Set(WORKSPACE_CLEANUP_STATES);
function record(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function nonempty(v, max = 1200) { return typeof v === 'string' && Boolean(v.trim()) && v.length <= max; }
function strings(v) { return Array.isArray(v) && v.length <= 128 && v.every(x => nonempty(x, 1024)) && new Set(v).size === v.length; }
function timestamp(v) { return typeof v === 'number' && Number.isFinite(v) && v > 0; }
function gitObject(v) { return typeof v === 'string' && /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(v); }
export function isIsolationDecisionContract(v) {
    if (!record(v) || !Object.keys(v).every(k => DECISION_KEYS.has(k)))
        return false;
    if (typeof v.required !== 'boolean' || !nonempty(v.reason, 800) || typeof v.strategy !== 'string' || !STRATEGIES.has(v.strategy) || !strings(v.scope) || !nonempty(v.requested_by, 300))
        return false;
    if (v.required && v.strategy === 'none')
        return false;
    if (!v.required && v.strategy !== 'none')
        return false;
    return true;
}
export function isWorkspaceLeaseContract(v) {
    if (!record(v) || !Object.keys(v).every(k => LEASE_KEYS.has(k)))
        return false;
    if (!nonempty(v.lease_id, 160) || !/^lease_[a-z0-9_]+$/.test(v.lease_id) || !nonempty(v.mission_id, 160) || !nonempty(v.task_id, 160))
        return false;
    if (!nonempty(v.repository_root, 2048) || !nonempty(v.base_ref, 512) || !nonempty(v.workspace_path, 2048) || !timestamp(v.created_at) || !gitObject(v.source_baseline))
        return false;
    if (v.host_workspace_id !== undefined && !nonempty(v.host_workspace_id, 512))
        return false;
    if (v.branch !== undefined && !nonempty(v.branch, 512))
        return false;
    if (typeof v.status !== 'string' || !STATUSES.has(v.status) || typeof v.cleanup_state !== 'string' || !CLEANUP.has(v.cleanup_state))
        return false;
    if (v.status === 'ACTIVE' && v.cleanup_state !== 'ACTIVE')
        return false;
    if (v.status === 'RECONCILING' && !['ACTIVE', 'CLEANUP_PENDING'].includes(v.cleanup_state))
        return false;
    if (v.status === 'CLOSED' && v.cleanup_state !== 'CLEANED')
        return false;
    if (v.status === 'ORPHANED' && v.cleanup_state !== 'QUARANTINED')
        return false;
    return true;
}
