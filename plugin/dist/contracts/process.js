import { createHash } from 'node:crypto';
export const PROCESS_STATUSES = ['RUNNING', 'EXITED', 'TIMED_OUT', 'TERMINATED', 'ORPHANED'];
export const PROCESS_CLEANUP_STATES = ['ACTIVE', 'CLEANUP_PENDING', 'CLEANED', 'QUARANTINED'];
export function isWaitableRunningProcess(process) { return process.status === 'RUNNING' && process.timeout_at !== undefined; }
export function isPersistentRunningProcess(process) { return process.status === 'RUNNING' && process.timeout_at === undefined; }
const KEYS = new Set(['process_id', 'mission_id', 'task_id', 'worker_id', 'host', 'command_identity', 'cwd', 'pid', 'process_group_id', 'status', 'started_at', 'ended_at', 'timeout_at', 'exit_code', 'termination_reason', 'output_artifact_refs', 'authority_ref', 'cleanup_state']);
const STATUS = new Set(PROCESS_STATUSES), CLEANUP = new Set(PROCESS_CLEANUP_STATES);
function record(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function nonempty(value) { return typeof value === 'string' && Boolean(value.trim()); }
function timestamp(value) { return typeof value === 'number' && Number.isFinite(value) && value > 0; }
function positiveInteger(value) { return Number.isInteger(value) && Number(value) > 0; }
function sha256(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }
function artifactRefs(value) { return Array.isArray(value) && value.length <= 64 && value.every(nonempty) && new Set(value).size === value.length; }
export function processCommandIdentity(input) {
    const host = input.host.trim(), command = input.command.trim(), cwd = input.cwd.trim();
    if (!host || !command || !cwd)
        throw new Error('Process command identity requires non-empty host, command and cwd');
    return createHash('sha256').update(`${host}\0${cwd}\0${command}`).digest('hex');
}
export function isProcessContract(value) {
    if (!record(value) || !Object.keys(value).every(key => KEYS.has(key)))
        return false;
    if (!nonempty(value.process_id) || !nonempty(value.mission_id) || !nonempty(value.task_id) || !nonempty(value.worker_id) || !nonempty(value.host) || !sha256(value.command_identity) || !nonempty(value.cwd) || !positiveInteger(value.pid))
        return false;
    if (value.process_group_id !== undefined && !positiveInteger(value.process_group_id))
        return false;
    if (typeof value.status !== 'string' || !STATUS.has(value.status) || !timestamp(value.started_at) || !artifactRefs(value.output_artifact_refs) || !nonempty(value.authority_ref) || typeof value.cleanup_state !== 'string' || !CLEANUP.has(value.cleanup_state))
        return false;
    if (value.ended_at !== undefined && (!timestamp(value.ended_at) || value.ended_at < value.started_at))
        return false;
    if (value.timeout_at !== undefined && (!timestamp(value.timeout_at) || value.timeout_at < value.started_at))
        return false;
    if (value.exit_code !== undefined && !Number.isInteger(value.exit_code))
        return false;
    if (value.termination_reason !== undefined && (!nonempty(value.termination_reason) || value.termination_reason.length > 800))
        return false;
    if (value.status === 'RUNNING') {
        if (value.ended_at !== undefined || value.exit_code !== undefined || value.termination_reason !== undefined)
            return false;
        if (!['ACTIVE', 'CLEANUP_PENDING'].includes(value.cleanup_state))
            return false;
    }
    else if (value.status !== 'ORPHANED') {
        if (value.ended_at === undefined)
            return false;
        if (value.cleanup_state === 'ACTIVE')
            return false;
    }
    if (value.status === 'EXITED') {
        if (value.exit_code === undefined || value.termination_reason !== undefined)
            return false;
    }
    else if (value.status === 'TIMED_OUT') {
        if (value.timeout_at === undefined || value.termination_reason === undefined || value.exit_code !== undefined)
            return false;
    }
    else if (value.status === 'TERMINATED') {
        if (value.termination_reason === undefined || value.exit_code !== undefined)
            return false;
    }
    else if (value.status === 'ORPHANED') {
        if (value.cleanup_state !== 'QUARANTINED' || value.termination_reason === undefined || value.exit_code !== undefined)
            return false;
    }
    if (value.cleanup_state === 'CLEANED' && value.status === 'RUNNING')
        return false;
    if (value.cleanup_state === 'QUARANTINED' && value.status !== 'ORPHANED')
        return false;
    return true;
}
