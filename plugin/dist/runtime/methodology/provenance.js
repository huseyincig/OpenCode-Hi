import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
function isRecord(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function stringArray(value) { return Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim().length > 0); }
function sha(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }
function parse(raw) {
    if (!isRecord(raw) || raw.schema !== 1 || raw.type !== 'hi-methodology-provenance')
        return undefined;
    if (typeof raw.name !== 'string' || !/^hi-project-[a-z0-9-]+$/.test(raw.name))
        return undefined;
    if (!['project-learning', 'explicit-user-request'].includes(String(raw.origin)))
        return undefined;
    if (!stringArray(raw.evidence) || raw.evidence.length === 0)
        return undefined;
    if (raw.origin === 'project-learning' && (typeof raw.candidate_id !== 'string' || !/^mc_[a-f0-9]{24}$/.test(raw.candidate_id)))
        return undefined;
    if (raw.origin === 'explicit-user-request' && raw.candidate_id !== undefined && (typeof raw.candidate_id !== 'string' || !/^mc_[a-f0-9]{24}$/.test(raw.candidate_id)))
        return undefined;
    if (!sha(raw.skill_sha256) || !sha(raw.policy_sha256))
        return undefined;
    if (typeof raw.created_at !== 'number' || typeof raw.validated_at !== 'number' || raw.created_at <= 0 || raw.validated_at < raw.created_at)
        return undefined;
    return raw;
}
export function projectMethodologyProvenancePath(projectRoot, name) {
    return join(projectRoot, '.opencode', 'hi', 'provenance', 'methodologies', `${name}.json`);
}
export function readProjectMethodologyProvenance(projectRoot, name) {
    const path = projectMethodologyProvenancePath(projectRoot, name);
    if (!existsSync(path))
        return undefined;
    try {
        return parse(JSON.parse(readFileSync(path, 'utf8')));
    }
    catch {
        return undefined;
    }
}
