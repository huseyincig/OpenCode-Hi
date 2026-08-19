export { normalizeWorkerResult } from '../../contracts/worker-result.js';
import { DEFAULT_CONTEXT_BUDGET, clipList, clipText } from '../context/budget.js';
export function workerHandoffText(h, maxChars = DEFAULT_CONTEXT_BUDGET.max_handoff_chars) {
    const resultFields = `status, summary, changed_files, scope_expansions, evidence, ${h.expected_output.findings ? 'findings, ' : ''}open_issues, needs_context, context_gap, failure_finding`;
    const reviewFindingInstruction = h.expected_output.findings
        ? 'Reviewer findings must use structured {id, reviewer_role, subject, severity, causality, scope, evidence_refs, confidence, disposition, blocking}. evidence_refs must name evidence.kind values returned by this same result. Mark unrelated existing debt as causality=pre-existing; do not convert it into an introduced/worsened blocker.'
        : '';
    const lines = [
        'Hi WORKER HANDOFF',
        'Control plane: Hi. Do not become a top-level orchestrator.',
        `OBJECTIVE: ${clipText(h.objective, 4000)}`,
        `SCOPE: ${clipList(h.scope, 3000).join(', ') || 'bounded by objective'}`,
        `CONSTRAINTS: ${clipList(h.constraints, 4000).join(' | ') || 'minimum sufficient change'}`,
        `REQUIRED EVIDENCE: ${clipList(h.required_evidence, 3000).join(' | ') || 'none'}`,
        `RELEVANT CONTEXT: ${clipList(h.relevant_context, 5000).join(' | ') || 'none'}`,
        `HI METHODOLOGIES: ${h.methodologies.join(', ') || 'none'}`,
        `METHODOLOGY EXIT REQUIREMENTS: ${h.methodology_exit_requirements?.join(' | ') || 'none'}`,
        h.methodologies.length
            ? 'Load each listed methodology through the OpenCode native skill tool before applying it. Do not load unrelated skills.'
            : 'No methodology is selected; use native engineering judgment without loading unrelated skills.',
        h.approval_gated_methodologies?.length
            ? `APPROVAL-GATED METHODOLOGIES: ${h.approval_gated_methodologies.join(', ')}. Native OpenCode permission ask/deny remains authoritative.`
            : 'APPROVAL-GATED METHODOLOGIES: none.',
        `Return compact JSON-compatible result with ${resultFields}.`,
        h.required_evidence.length ? 'Required evidence kinds are canonical IDs: when satisfied, emit those exact values as evidence.kind; never rename or alias them. If unmet, report the gap instead of fabricating proof.' : '',
        reviewFindingInstruction,
        'Use context_gap=scope|iterative|none and failure_finding=ci-build|unknown-root-cause|none only when directly supported by this bounded task.',
        'Evidence is structured proof, not prose classification: when a worker-scope methodology exit requires decision-evidence, diagnostic-evidence, measurement-evidence, browser-evidence, visual-evidence, accessibility-evidence, or source-provenance-evidence, return that exact evidence.kind with a concrete summary/scope; targeted-test-evidence may be satisfied by evidence.kind=targeted-tests. Passed browser/visual/accessibility evidence must include evidence_refs returned by the actual Hi browser tool observations from this task/attempt.',
        'Methodology-exit evidence is accepted only as fresh passed proof. Set evidence.outcome="passed" (or pass=true) only when the actual observation/check supports that claim; omit pass/outcome when evidence is merely observed, partial, uncertain, or pending. Never manufacture PASS from a BrowserObservation or screenshot alone.',
        'Do not rely on descriptive summary words to satisfy an exit.',
        'Optionally include methodology_observations only when this task produced a project-specific reusable HOW that is not already a selected methodology; each observation must contain key, procedure, trigger, do_not_trigger, exit_condition, evidence; observation.evidence must list exact evidence.kind values returned by this result, never summary fragments.',
        'Do not report project facts, one-off evidence, or control-plane policy as methodology observations.',
        'Use status DONE, FIX_REQUIRED, NEEDS_CONTEXT, BLOCKED, or FAILED.',
        'For every changed file outside SCOPE, include scope_expansions entry {file, necessary, reason}. Mark necessary=true only when the task cannot be correctly completed without that file; otherwise revert the collateral change before DONE.'
    ].filter(Boolean);
    return clipText(lines.join('\n'), maxChars);
}
