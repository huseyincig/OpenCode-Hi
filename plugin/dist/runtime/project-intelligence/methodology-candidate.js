import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { projectMethodologyCandidatePath } from '../storage/ownership.js';
const DAY = 24 * 60 * 60 * 1000;
export const PROJECT_METHODOLOGY_CONFIDENCE_DECAY_DAYS = 30;
export const PROJECT_METHODOLOGY_READY_CONFIDENCE = 0.70;
function digest(value) { return createHash('sha256').update(value).digest('hex'); }
export function methodologyCandidateDigest(o) { return digest([o.key, o.procedure, o.trigger, o.do_not_trigger, o.exit_condition].join('\0')); }
export function methodologyCandidateID(o) { return `mc_${methodologyCandidateDigest(o).slice(0, 24)}`; }
function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
function finitePositive(v) { return typeof v === 'number' && Number.isFinite(v) && v > 0; }
function validObservation(value) { if (!value || typeof value !== 'object' || Array.isArray(value))
    return false; const v = value; return nonempty(v.mission_id) && nonempty(v.task_id) && nonempty(v.worker_id) && Array.isArray(v.evidence) && v.evidence.length > 0 && v.evidence.every(nonempty) && finitePositive(v.observed_at) && (v.outcome === undefined || v.outcome === 'helpful' || v.outcome === 'harmful'); }
function derivedLearning(observations) {
    const positive = observations.filter(o => o.outcome !== 'harmful'), negative = observations.filter(o => o.outcome === 'harmful');
    return { alpha: 1 + positive.length, beta: 1 + negative.length, positive: positive.length, negative: negative.length, last_positive_at: Math.max(0, ...positive.map(o => o.observed_at)), ...(negative.length ? { last_negative_at: Math.max(...negative.map(o => o.observed_at)) } : {}) };
}
function validLearning(value, observations) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
    const v = value, expected = derivedLearning(observations);
    return finitePositive(v.alpha) && finitePositive(v.beta) && Number.isInteger(v.positive) && Number.isInteger(v.negative) && v.positive === expected.positive && v.negative === expected.negative && v.alpha === expected.alpha && v.beta === expected.beta && v.last_positive_at === expected.last_positive_at && v.last_negative_at === expected.last_negative_at;
}
export function methodologyCandidateLearning(candidate) { return candidate.learning ? { ...candidate.learning } : derivedLearning(candidate.observations); }
export function methodologyCandidateAssessment(candidate, now = Date.now()) {
    const learning = methodologyCandidateLearning(candidate), independent = new Set(candidate.observations.map(o => `${o.mission_id}:${o.task_id}`)).size, frequency = Math.max(1, learning.positive + learning.negative), posterior = learning.alpha / (learning.alpha + learning.beta), lastSignal = Math.max(learning.last_positive_at, learning.last_negative_at ?? 0, candidate.updated_at), age = Math.max(0, now - lastSignal), threshold = PROJECT_METHODOLOGY_CONFIDENCE_DECAY_DAYS * DAY, halfLife = threshold * (1 + Math.log2(1 + frequency)), ageBeyond = Math.max(0, age - threshold), timeFactor = Math.exp((-Math.LN2 * ageBeyond) / halfLife), ageDays = age / DAY, trendMultiplier = .8 + .2 * Math.exp(-ageDays / 30), effective = posterior * Math.min(timeFactor, trendMultiplier), eligible = candidate.state === 'READY' && independent >= 2 && effective >= PROJECT_METHODOLOGY_READY_CONFIDENCE;
    const reason = candidate.state === 'ARCHIVED' ? 'archived' : independent < 2 || candidate.state !== 'READY' ? 'insufficient-independent-evidence' : effective < PROJECT_METHODOLOGY_READY_CONFIDENCE ? 'confidence-below-floor' : 'admitted';
    return { eligible, reason, positive: learning.positive, negative: learning.negative, independent_tasks: independent, posterior_confidence: posterior, effective_confidence: effective, age_days: ageDays, half_life_days: halfLife / DAY, freshness: age > threshold ? 'DECAYED' : 'FRESH' };
}
export function withDerivedMethodologyLearning(candidate) { return { ...candidate, observations: candidate.observations.map(o => ({ ...o, evidence: [...o.evidence] })), learning: derivedLearning(candidate.observations) }; }
export function validProjectMethodologyCandidate(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return false;
    const v = raw;
    if (v.schema !== 1 || !nonempty(v.id) || !/^mc_[a-f0-9]{24}$/.test(v.id) || !nonempty(v.key) || !nonempty(v.contract_sha256) || !/^[a-f0-9]{64}$/.test(v.contract_sha256))
        return false;
    if (!nonempty(v.procedure) || !nonempty(v.trigger) || !nonempty(v.do_not_trigger) || !nonempty(v.exit_condition) || !['CANDIDATE', 'READY', 'ARCHIVED'].includes(String(v.state)))
        return false;
    if (!Array.isArray(v.observations) || !v.observations.every(validObservation) || !finitePositive(v.created_at) || !finitePositive(v.updated_at) || v.updated_at < v.created_at)
        return false;
    const observations = v.observations;
    if (v.learning !== undefined && !validLearning(v.learning, observations))
        return false;
    const contract = { key: v.key, procedure: v.procedure, trigger: v.trigger, do_not_trigger: v.do_not_trigger, exit_condition: v.exit_condition };
    const expected = methodologyCandidateDigest(contract);
    if (v.contract_sha256 !== expected || v.id !== `mc_${expected.slice(0, 24)}`)
        return false;
    const keys = observations.map(o => `${o.mission_id}:${o.task_id}`), independent = new Set(keys).size;
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
        return validProjectMethodologyCandidate(raw) ? withDerivedMethodologyLearning(raw) : undefined;
    }
    catch {
        return undefined;
    }
}
