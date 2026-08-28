import { EVIDENCE_OUTCOMES, WORKER_EVIDENCE_KINDS } from './evidence-kinds.js';
const stringArray = { type: 'array', items: { type: 'string' } };
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
        id: { type: 'string' }, reviewer_role: { type: 'string' }, subject: { type: 'string' },
        severity: { type: 'string', enum: ['info', 'low', 'medium', 'high', 'critical'] },
        causality: { type: 'string', enum: ['introduced', 'worsened', 'pre-existing', 'unknown'] },
        scope: stringArray, evidence_refs: stringArray, confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        disposition: { type: 'string', enum: ['open', 'resolved', 'rejected', 'parked'] }, blocking: { type: 'boolean' },
    },
};
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
