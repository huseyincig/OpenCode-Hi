export { normalizeWorkerResult } from '../../contracts/worker-result.js'
import { DEFAULT_CONTEXT_BUDGET,clipList,clipText } from '../context/budget.js'

export interface WorkerHandoff {
  objective:string
  scope:string[]
  constraints:string[]
  required_evidence:string[]
  relevant_context:string[]
  methodologies:string[]
  methodology_exit_requirements?:string[]
  approval_gated_methodologies?:string[]
  expected_output:{
    status:true
    summary:true
    changed_files:true
    scope_expansions:true
    evidence:true
    findings?:true
    open_issues:true
  }
}

export function workerHandoffText(h:WorkerHandoff,maxChars:number=DEFAULT_CONTEXT_BUDGET.max_handoff_chars):string {
  const resultFields=`status, summary, changed_files, scope_expansions, evidence, ${h.expected_output.findings?'findings, ':''}open_issues, needs_context, context_gap, failure_finding`
  const exitRequirements=h.methodologies.length?[...(h.methodology_exit_requirements??[])]:[]
  const visualProof=[...h.required_evidence,...exitRequirements,...h.methodologies].some(value=>/(?:browser|visual|accessibility)/i.test(value))
  const reviewFindingInstruction=h.expected_output.findings
    ? 'Reviewer findings: {id, reviewer_role, subject, severity, causality, scope, evidence_refs, confidence, disposition, blocking}; evidence_refs must name evidence.kind values from this result; unrelated existing debt is causality=pre-existing.'
    : ''
  const lines=[
    'Hi WORKER HANDOFF',
    `OBJECTIVE: ${clipText(h.objective,4000)}`,
    `SCOPE: ${clipList(h.scope,3000).join(', ')||'bounded by objective'}`,
    `CONSTRAINTS: ${clipList(h.constraints,4000).join(' | ')||'minimum sufficient change'}`,
    h.required_evidence.length?`REQUIRED EVIDENCE: ${clipList(h.required_evidence,3000).join(' | ')}`:'',
    h.relevant_context.length?`RELEVANT CONTEXT: ${clipList(h.relevant_context,5000).join(' | ')}`:'',
    exitRequirements.length?`METHODOLOGY EXIT REQUIREMENTS: ${exitRequirements.join(' | ')}`:'',
    h.approval_gated_methodologies?.length?`APPROVAL-GATED METHODOLOGIES: ${h.approval_gated_methodologies.join(', ')}; OpenCode native ask/deny remains authoritative.`:'',
    `RESULT: compact JSON; status= DONE|FIX_REQUIRED|NEEDS_CONTEXT|BLOCKED|FAILED; fields=${resultFields}.`,
    h.required_evidence.length?'Required evidence kinds are canonical IDs: emit those exact values as evidence.kind; never rename or alias them; if unmet, report the gap and never invent proof.':'',
    reviewFindingInstruction,
    'Optional signals only when supported: context_gap=scope|iterative|none; failure_finding=ci-build|unknown-root-cause|none.',
    exitRequirements.length?'Methodology exits require fresh passed structured evidence; summary wording alone never satisfies an exit. targeted-test-evidence may use evidence.kind=targeted-tests.':'',
    visualProof?'Set evidence.outcome="passed" (or pass=true) only after the claimed check actually passes. Never manufacture PASS from a BrowserObservation or screenshot alone; browser/visual/accessibility PASS must cite the actual Hi browser observation(s) in evidence_refs.':'',
    'Optional methodology_observations only for reusable project-specific HOW; cite exact returned evidence.kind values, never project facts, one-off evidence, or control-plane policy.',
    'For changed files outside SCOPE, return scope_expansions {file, necessary, reason}; otherwise remove collateral changes before DONE.'
  ].filter(Boolean)
  return clipText(lines.join('\n'),maxChars)
}
