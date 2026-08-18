import type { MissionState } from '../mission/types.js'
import { SEMANTIC_CAPABILITIES, SEMANTIC_EXTERNAL_ACTIONS, SEMANTIC_VERIFICATION_KINDS } from './semantic-assessment.js'

export function renderSemanticAssessmentGate(m:MissionState):string{
  const semantic=m.identity.semantic_assessment
  const messageKinds=semantic.phase==='initial'?'mission|non-material':'amendment|constraint|verification|stop|resume|non-material'
  const phaseRule=semantic.phase==='initial'?'Initial: non-material=>material=false; mission=>material=true.':'Follow-up: preserve prior semantics unless changed; non-material=>material=false, other kinds=>material=true.'
  return[
    'Hi SEMANTIC ASSESSMENT GATE',
    `rev=${semantic.revision};phase=${semantic.phase}; call hi_intent_assess exactly once; use user language, no keyword heuristic.`,
    `JSON: material:boolean; message_kind(M); task_kind(T); scope(S); risk(R); ambiguity(A); dependency_class(D); required_capabilities(C[]); requested_external_actions(X[]); likely_verification(V[]); likely_targets[]; intent_signals[]. M=${messageKinds}; T=implementation|bug-fix|review|performance|release-readiness; S=local|multi-file|repo-wide|external|multi-stream; R=low|medium|high|authority-boundary; A=none|resolvable|contract-critical; D=independent|sequential|external-gated|unknown|independent-multi.`,
    `C=${SEMANTIC_CAPABILITIES.join('|')}; X=${SEMANTIC_EXTERNAL_ACTIONS.join('|')}; V=${SEMANTIC_VERIFICATION_KINDS.join('|')}. C only C-list; V only V-list. intent_signals=[] by default; explicit intent.<slug>, e.g. intent.tdd; unknown signals reject.`,
    'scope and dependency_class describe material implementation/change work units; multi-file=>2+ material targets; not test files that the user says must remain unchanged; sequential=2+ ordered units; one implementation change followed by verification is not a sequential dependency.',
    'intent.tdd only explicit test-first/test-authoring; existing failing test/test command is verification. Select intent.debugging only when root-cause diagnosis is materially required; if diagnosis is required include repository-analysis in required_capabilities. independent-review only for explicit user independence or risk/policy requirement. likely_targets=paths/HTTP(S)-URLs. X nonempty=>R=authority-boundary.',
    phaseRule,
  ].join('\n')
}
