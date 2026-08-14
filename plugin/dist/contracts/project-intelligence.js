import { isSafeProjectFileSourceRef } from './common.js';
export const PROJECT_INTELLIGENCE_FRESHNESS = ['FRESH', 'POTENTIALLY_STALE'];
export const PROJECT_INTELLIGENCE_LIFECYCLES = ['ACTIVE', 'SUPERSEDED', 'ARCHIVED'];
export const PROJECT_INTELLIGENCE_CONSUMERS = ['task-context'];
const KEYS = new Set(['id', 'statement', 'source_refs', 'observed_commit', 'confidence', 'freshness', 'lifecycle', 'consumer_domains', 'updated_at']);
const SOURCE_KEYS = new Set(['ref', 'hash']);
const FRESH = new Set(PROJECT_INTELLIGENCE_FRESHNESS), LIFE = new Set(PROJECT_INTELLIGENCE_LIFECYCLES), CONSUMERS = new Set(PROJECT_INTELLIGENCE_CONSUMERS);
function record(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function validSource(v) { return record(v) && Object.keys(v).every(k => SOURCE_KEYS.has(k)) && isSafeProjectFileSourceRef(v.ref) && typeof v.hash === 'string' && /^[a-f0-9]{64}$/.test(v.hash); }
export function isProjectIntelligenceContract(v) {
    if (!record(v) || !Object.keys(v).every(k => KEYS.has(k)) || typeof v.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(v.id) || typeof v.statement !== 'string' || !v.statement.trim() || !Array.isArray(v.source_refs) || v.source_refs.length === 0 || !v.source_refs.every(validSource))
        return false;
    if (new Set(v.source_refs.map(s => s.ref)).size !== v.source_refs.length)
        return false;
    if (v.observed_commit !== undefined && (typeof v.observed_commit !== 'string' || !v.observed_commit.trim()))
        return false;
    if (typeof v.confidence !== 'number' || !Number.isFinite(v.confidence) || v.confidence < 0 || v.confidence > 1 || typeof v.freshness !== 'string' || !FRESH.has(v.freshness) || typeof v.lifecycle !== 'string' || !LIFE.has(v.lifecycle) || !Array.isArray(v.consumer_domains) || v.consumer_domains.length === 0 || !v.consumer_domains.every(x => typeof x === 'string' && CONSUMERS.has(x)) || new Set(v.consumer_domains).size !== v.consumer_domains.length || typeof v.updated_at !== 'number' || !Number.isFinite(v.updated_at) || v.updated_at <= 0)
        return false;
    return true;
}
export function projectIntelligenceFiles(v) { return v.source_refs.map(x => x.ref.slice(5)); }
