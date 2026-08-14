const RESULT = new Set(['passed', 'failed', 'pending', 'environment-issue', 'not_run']);
const CHECK_KEYS = new Set(['kind', 'subject', 'result', 'evidence_refs', 'explanation']);
const ENVELOPE_KEYS = new Set(['checks', 'scope', 'freshness', 'limitations', 'independent_review']);
function record(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function strings(v) { return Array.isArray(v) && v.every(x => typeof x === 'string'); }
function validCheck(v) { if (!record(v) || !Object.keys(v).every(k => CHECK_KEYS.has(k)) || typeof v.kind !== 'string' || !v.kind || typeof v.subject !== 'string' || !v.subject || typeof v.result !== 'string' || !RESULT.has(v.result) || !strings(v.evidence_refs))
    return false; if (v.explanation !== undefined && typeof v.explanation !== 'string')
    return false; if (v.result === 'not_run' && !v.explanation)
    return false; if (v.result === 'passed' && v.evidence_refs.length === 0)
    return false; return true; }
export function isVerificationEnvelopeContract(v) { return record(v) && Object.keys(v).every(k => ENVELOPE_KEYS.has(k)) && Array.isArray(v.checks) && v.checks.every(validCheck) && strings(v.scope) && ['fresh', 'stale'].includes(String(v.freshness)) && strings(v.limitations) && typeof v.independent_review === 'boolean'; }
