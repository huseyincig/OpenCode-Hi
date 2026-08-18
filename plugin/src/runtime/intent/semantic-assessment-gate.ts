import type { MissionState } from '../mission/types.js'
import { SEMANTIC_CAPABILITIES, SEMANTIC_EXTERNAL_ACTIONS, SEMANTIC_VERIFICATION_KINDS } from './semantic-assessment.js'

export function renderSemanticAssessmentGate(m:MissionState):string{
  const semantic=m.identity.semantic_assessment
  const messageKinds=semantic.phase==='initial'?'mission|non-material':'amendment|constraint|verification|stop|resume|non-material'
  const phaseRule=semantic.phase==='initial'?'Initial: non-material=>material=false; mission=>material=true.':'Follow-up: preserve prior semantics unless changed; non-material=>material=false, other kinds=>material=true.'
  return[
    'Hi SEMANTIC ASSESSMENT GATE',
    `rev=${semantic.revision};phase=${semantic.phase}. call hi_intent_assess exactly once before execution. Use user language semantics; no language-specific keyword heuristic.`,
    `JSON: material:boolean; message_kind(M); task_kind(T); scope(S); risk(R); ambiguity(A); dependency_class(D); required_capabilities(C[]); requested_external_actions(X[]); likely_verification(V[]); likely_targets[]; intent_signals[]; suppressed_intent_signals[]. M=${messageKinds}; T=implementation|bug-fix|review|performance|release-readiness; S=local|multi-file|repo-wide|external|multi-stream; R=low|medium|high|authority-boundary; A=none|resolvable|contract-critical; D=independent|sequential|external-gated|unknown|independent-multi.`,
    `C=${SEMANTIC_CAPABILITIES.join('|')}; X=${SEMANTIC_EXTERNAL_ACTIONS.join('|')}; V=${SEMANTIC_VERIFICATION_KINDS.join('|')}. intent_signals=[] by default; only explicit methodology intent may use intuitive intent.<slug> (e.g. intent.tdd|intent.debugging|intent.security-review|intent.code-review|intent.planning); unknown signals reject.`,
    'scope and dependency_class describe material implementation/change work units, not verifier-only/read-only or test files that the user says must remain unchanged; sequential=2+ ordered material units; one implementation change followed by verification is not a sequential dependency.',
    'Select intent.debugging only when root-cause diagnosis is materially required; if diagnosis is required include repository-analysis in required_capabilities. likely_targets=explicit/high-confidence. X=only requested effects; X nonempty=>R=authority-boundary.',
    phaseRule,
  ].join('\n')
}
