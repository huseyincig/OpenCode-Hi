import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { projectMethodologyCandidatePath } from '../storage/ownership.js';
function digest(value) { return createHash('sha256').update(value).digest('hex'); }
export function methodologyCandidateDigest(o) { return digest([o.key, o.procedure, o.trigger, o.do_not_trigger, o.exit_condition].join('\0')); }
export function methodologyCandidateID(o) { return `mc_${methodologyCandidateDigest(o).slice(0, 24)}`; }
function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
function validObservation(value) { if (!value || typeof value !== 'object' || Array.isArray(value))
    return false; const v = value; return nonempty(v.mission_id) && nonempty(v.task_id) && nonempty(v.worker_id) && Array.isArray(v.evidence) && v.evidence.length > 0 && v.evidence.every(nonempty) && typeof v.observed_at === 'number' && Number.isFinite(v.observed_at) && v.observed_at > 0; }
export function validProjectMethodologyCandidate(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return false;
    const v = raw;
    if (v.schema !== 1 || !nonempty(v.id) || !/^mc_[a-f0-9]{24}$/.test(v.id) || !nonempty(v.key) || !nonempty(v.contract_sha256) || !/^[a-f0-9]{64}$/.test(v.contract_sha256))
        return false;
    if (!nonempty(v.procedure) || !nonempty(v.trigger) || !nonempty(v.do_not_trigger) || !nonempty(v.exit_condition) || !['CANDIDATE', 'READY', 'ARCHIVED'].includes(String(v.state)))
        return false;
    if (!Array.isArray(v.observations) || !v.observations.every(validObservation) || typeof v.created_at !== 'number' || typeof v.updated_at !== 'number' || v.created_at <= 0 || v.updated_at < v.created_at)
        return false;
    const contract = { key: v.key, procedure: v.procedure, trigger: v.trigger, do_not_trigger: v.do_not_trigger, exit_condition: v.exit_condition };
    const expected = methodologyCandidateDigest(contract);
    if (v.contract_sha256 !== expected || v.id !== `mc_${expected.slice(0, 24)}`)
        return false;
    const keys = v.observations.map(o => `${o.mission_id}:${o.task_id}`), independent = new Set(keys).size;
    if (independent !== keys.length)
        return false;
    if (v.state === 'READY' && independent < 2)
        return false;
    if (v.state === 'CANDIDATE' && independent >= 2)
        return false;
    return true;
}
export function readProjectMethodologyCandidate(projectRoot, id) {
    if (!/^mc_[a-f0-9]{24}$/.test(id))
        return undefined;
    const path = projectMethodologyCandidatePath(projectRoot, id);
    if (!existsSync(path))
        return undefined;
    try {
        const raw = JSON.parse(readFileSync(path, 'utf8'));
        return validProjectMethodologyCandidate(raw) ? raw : undefined;
    }
    catch {
        return undefined;
    }
}
