import { EVIDENCE_OUTCOMES, WORKER_EVIDENCE_KINDS } from './evidence-kinds.js';
import { isReviewFindingContract } from './review-finding.js';
const stringArray = { type: 'array', items: { type: 'string' } };
const evidenceKindArray = { type: 'array', maxItems: 20, items: { type: 'string', enum: [...WORKER_EVIDENCE_KINDS] } };
const REVIEW_FINDING_ID_PATTERN = '^rf-[a-z0-9][a-z0-9-]{0,79}$';
const REVIEWER_ROLE_PATTERN = '^[a-z][a-z0-9-]{1,63}$';
const evidenceClaim = {
    type: 'object', additionalProperties: false, required: ['kind', 'summary'],
    properties: {
        kind: { type: 'string', enum: [...WORKER_EVIDENCE_KINDS] }, summary: { type: 'string' }, scope: stringArray, evidence_refs: stringArray,
        pass: { type: 'boolean' }, outcome: { type: 'string', enum: [...EVIDENCE_OUTCOMES] }, reason: { type: 'string' },
    },
};
const reviewFinding = {
    type: 'object', additionalProperties: false, required: ['id', 'reviewer_role', 'subject', 'severity', 'causality', 'scope', 'evidence_refs', 'confidence', 'disposition', 'blocking'],
    properties: {
        id: { type: 'string', pattern: REVIEW_FINDING_ID_PATTERN }, reviewer_role: { type: 'string', pattern: REVIEWER_ROLE_PATTERN }, subject: { type: 'string', minLength: 1, maxLength: 1200 },
        severity: { type: 'string', enum: ['info', 'low', 'medium', 'high', 'critical'] },
        causality: { type: 'string', enum: ['introduced', 'worsened', 'pre-existing', 'unknown'] },
        scope: { type: 'array', maxItems: 50, items: { type: 'string' } }, evidence_refs: evidenceKindArray, confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        disposition: { type: 'string', enum: ['open', 'resolved', 'rejected', 'parked'] }, blocking: { type: 'boolean' },
    },
};
const WORKER_RESULT_TRANSPORT_KEYS = new Set(['status', 'summary', 'changed_files', 'scope_expansions', 'evidence', 'verification_coverage', 'findings', 'open_issues', 'needs_context', 'context_gap', 'failure_finding', 'methodology_observations']);
const EVIDENCE_KIND_SET = new Set(WORKER_EVIDENCE_KINDS), EVIDENCE_OUTCOME_SET = new Set(EVIDENCE_OUTCOMES);
function record(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function exactKeys(value, allowed) { return Object.keys(value).every(key => allowed.has(key)); }
function strings(value) { return Array.isArray(value) && value.every(item => typeof item === 'string'); }
function optionalString(value) { return value === undefined || typeof value === 'string'; }
function optionalStrings(value) { return value === undefined || strings(value); }
function transportEvidence(value) { if (!record(value))
    return false; const allowed = new Set(['kind', 'summary', 'scope', 'evidence_refs', 'pass', 'outcome', 'reason']); return exactKeys(value, allowed) && typeof value.kind === 'string' && EVIDENCE_KIND_SET.has(value.kind) && typeof value.summary === 'string' && optionalStrings(value.scope) && optionalStrings(value.evidence_refs) && (value.pass === undefined || typeof value.pass === 'boolean') && (value.outcome === undefined || typeof value.outcome === 'string' && EVIDENCE_OUTCOME_SET.has(value.outcome)) && optionalString(value.reason); }
function transportScopeExpansion(value) { if (!record(value))
    return false; const allowed = new Set(['file', 'reason', 'necessary']); return exactKeys(value, allowed) && typeof value.file === 'string' && typeof value.reason === 'string' && typeof value.necessary === 'boolean'; }
function transportCoverage(value) { if (!record(value))
    return false; const allowed = new Set(['case_id', 'outcome', 'evidence_refs', 'reason']); return exactKeys(value, allowed) && typeof value.case_id === 'string' && (value.outcome === 'passed' || value.outcome === 'failed') && strings(value.evidence_refs) && optionalString(value.reason); }
function transportFinding(value) { return isReviewFindingContract(value); }
function transportMethodologyObservation(value) { if (!record(value))
    return false; const allowed = new Set(['key', 'procedure', 'trigger', 'do_not_trigger', 'exit_condition', 'evidence']); return exactKeys(value, allowed) && typeof value.key === 'string' && typeof value.procedure === 'string' && typeof value.trigger === 'string' && typeof value.do_not_trigger === 'string' && typeof value.exit_condition === 'string' && Array.isArray(value.evidence) && value.evidence.every(item => typeof item === 'string' && EVIDENCE_KIND_SET.has(item)); }
/** Re-validates the static OpenCode transport envelope before Hi normalization. Dynamic task/evidence semantics remain outside this predicate. */
export function isWorkerResultTransportContract(value) {
    if (!record(value) || !exactKeys(value, WORKER_RESULT_TRANSPORT_KEYS))
        return false;
    if (!['DONE', 'FIX_REQUIRED', 'NEEDS_CONTEXT', 'BLOCKED', 'FAILED'].includes(String(value.status)) || typeof value.summary !== 'string' || !strings(value.changed_files) || !Array.isArray(value.evidence) || !value.evidence.every(transportEvidence) || !strings(value.open_issues) || !strings(value.needs_context))
        return false;
    if (value.scope_expansions !== undefined && (!Array.isArray(value.scope_expansions) || !value.scope_expansions.every(transportScopeExpansion)))
        return false;
    if (value.verification_coverage !== undefined && (!Array.isArray(value.verification_coverage) || !value.verification_coverage.every(transportCoverage)))
        return false;
    if (value.findings !== undefined && (!Array.isArray(value.findings) || !value.findings.every(transportFinding)))
        return false;
    if (value.context_gap !== undefined && !['scope', 'iterative', 'none'].includes(String(value.context_gap)))
        return false;
    if (value.failure_finding !== undefined && !['ci-build', 'unknown-root-cause', 'none'].includes(String(value.failure_finding)))
        return false;
    if (value.methodology_observations !== undefined && (!Array.isArray(value.methodology_observations) || !value.methodology_observations.every(transportMethodologyObservation)))
        return false;
    return true;
}
/** Native OpenCode transport schema. Hi semantic/provenance validators remain authoritative after transport validation. */
export const WORKER_RESULT_JSON_SCHEMA = {
    type: 'object', additionalProperties: false,
    required: ['status', 'summary', 'changed_files', 'evidence', 'open_issues', 'needs_context'],
    properties: {
        status: { type: 'string', enum: ['DONE', 'FIX_REQUIRED', 'NEEDS_CONTEXT', 'BLOCKED', 'FAILED'] }, summary: { type: 'string' }, changed_files: stringArray,
        scope_expansions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['file', 'reason', 'necessary'], properties: { file: { type: 'string' }, reason: { type: 'string' }, necessary: { type: 'boolean' } } } },
        evidence: { type: 'array', items: evidenceClaim },
        verification_coverage: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['case_id', 'outcome', 'evidence_refs'], properties: { case_id: { type: 'string' }, outcome: { type: 'string', enum: ['passed', 'failed'] }, evidence_refs: stringArray, reason: { type: 'string' } } } },
        findings: { type: 'array', items: reviewFinding }, open_issues: stringArray, needs_context: stringArray,
        context_gap: { type: 'string', enum: ['scope', 'iterative', 'none'] }, failure_finding: { type: 'string', enum: ['ci-build', 'unknown-root-cause', 'none'] },
        methodology_observations: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['key', 'procedure', 'trigger', 'do_not_trigger', 'exit_condition', 'evidence'], properties: { key: { type: 'string' }, procedure: { type: 'string' }, trigger: { type: 'string' }, do_not_trigger: { type: 'string' }, exit_condition: { type: 'string' }, evidence: { type: 'array', items: { type: 'string', enum: [...WORKER_EVIDENCE_KINDS] } } } } },
    },
};
/** retryCount=0 keeps recovery ownership in Hi; OpenCode validates one native structured result but never hides a retry loop. */
export function workerResultOutputFormat() { return { type: 'json_schema', schema: WORKER_RESULT_JSON_SCHEMA, retryCount: 0 }; }
