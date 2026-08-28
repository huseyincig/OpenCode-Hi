export { normalizeWorkerResult } from '../../contracts/worker-result.js';
import { DEFAULT_CONTEXT_BUDGET, clipList, clipText } from '../context/budget.js';
export function workerHandoffText(h, maxChars = DEFAULT_CONTEXT_BUDGET.max_handoff_chars) {
    const resultFields = `status, summary, changed_files, scope_expansions, evidence, ${h.expected_output.findings ? 'findings, ' : ''}open_issues, needs_context, context_gap, failure_finding`;
    const exitRequirements = h.methodologies.length ? [...(h.methodology_exit_requirements ?? [])] : [];
    const visualProof = [...h.required_evidence, ...exitRequirements, ...h.methodologies].some(value => /(?:browser|visual|accessibility)/i.test(value));
    const reviewFindingInstruction = h.expected_output.findings
        ? 'Reviewer findings: {id, reviewer_role, subject, severity, causality, scope, evidence_refs, confidence, disposition, blocking}; evidence_refs must name evidence.kind values from this result; unrelated existing debt is causality=pre-existing.'
        : '';
    const reviewEvidenceInstruction = h.expected_output.findings && h.required_evidence.includes('review-evidence')
        ? 'Reviewer closure: emit evidence.kind="review-evidence" for the bounded review verdict. Do not invent provider-, package-, advisory-, CVE-, or scanner-specific evidence.kind IDs; put those source details in evidence.summary and findings. A passing review uses outcome="passed" only after the scoped review is complete; a blocking introduced finding must return FIX_REQUIRED rather than a prose-only DONE.'
        : '';
    const lines = [
        'Hi WORKER HANDOFF',
        `OBJECTIVE: ${clipText(h.objective, 4000)}`,
        `SCOPE: ${clipList(h.scope, 3000).join(', ') || 'bounded by objective'}`,
        `CONSTRAINTS: ${clipList(h.constraints, 4000).join(' | ') || 'minimum sufficient change'}`,
        h.required_evidence.length ? `REQUIRED EVIDENCE: ${clipList(h.required_evidence, 3000).join(' | ')}` : '',
        h.relevant_context.length ? `RELEVANT CONTEXT: ${clipList(h.relevant_context, 5000).join(' | ')}` : '',
        exitRequirements.length ? `METHODOLOGY EXIT REQUIREMENTS: ${exitRequirements.join(' | ')}` : '',
        h.approval_gated_methodologies?.length ? `APPROVAL-GATED METHODOLOGIES: ${h.approval_gated_methodologies.join(', ')}; OpenCode native ask/deny remains authoritative.` : '',
        `RESULT: compact JSON; status= DONE|FIX_REQUIRED|NEEDS_CONTEXT|BLOCKED|FAILED; fields=${resultFields}.`,
        'RESULT SHAPE: every evidence claim MUST be nested under the top-level evidence array, exactly as evidence:[{kind,summary,scope?,evidence_refs?,pass?,outcome?,reason?}]. Never emit source-provenance-evidence, review-evidence, visual-evidence, or any other evidence kind as its own top-level JSON key.',
        ...(h.result_contract_instructions ?? []),
        h.required_evidence.length ? 'Required evidence kinds are canonical IDs: emit those exact values as evidence.kind; never rename or alias them; if unmet, report the gap and never invent proof.' : '',
        reviewFindingInstruction,
        reviewEvidenceInstruction,
        'Optional signals only when supported: context_gap=scope|iterative|none; failure_finding=ci-build|unknown-root-cause|none.',
        exitRequirements.length ? 'Methodology exits require fresh passed structured evidence; summary wording alone never satisfies an exit. targeted-test-evidence may use evidence.kind=targeted-tests.' : '',
        visualProof ? 'For visual-check / hi-visual-qa, emit evidence.kind="visual-evidence" with evidence.outcome="passed" only after the claimed browser-visible state actually passes. Hi browser tools return an evidence_ref field whose FULL opaque value must be copied verbatim into evidence_refs, including every underscore-delimited suffix segment; format example only: ev_ab12cd34_q1w2e3. A prefix such as ev_ab12cd34 is NOT the same evidence identity and is invalid. Do not substitute or abbreviate an observation_id. Each array element must contain only the exact returned ref token, never labels, arrows, dimensions, or prose annotations. hi_browser_screenshot provides the pixels as a native image attachment; screenshot_artifact_ref=hi-artifact:... is supplemental opaque canonical provenance, not a filesystem path, so never read/glob/find it. Never manufacture PASS from a BrowserObservation or screenshot alone. Return the WorkerResult directly in assistant text; never write a temporary/result JSON file.' : '',
        'Optional methodology_observations only for reusable project-specific HOW; cite exact returned evidence.kind values, never project facts, one-off evidence, or control-plane policy.',
        'For changed files outside SCOPE, return scope_expansions {file, necessary, reason}; otherwise remove collateral changes before DONE.'
    ].filter(Boolean);
    return clipText(lines.join('\n'), maxChars);
}
