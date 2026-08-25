import { activeConstraintAtoms } from '../constraint/constraint-atoms.js';
import { SEMANTIC_CAPABILITIES, SEMANTIC_EXTERNAL_ACTIONS, SEMANTIC_VERIFICATION_KINDS } from './semantic-assessment.js';
function boundedRelevantActiveAtoms(m, limit = 10) {
    const active = activeConstraintAtoms(m.execution.constraint_atoms), text = m.identity.semantic_assessment.pending_text?.toLowerCase() ?? '', recent = [...active].reverse(), relevant = recent.filter(atom => { const subject = atom.subject.trim().toLowerCase(); return subject.length >= 3 && text.includes(subject); }), relevantIDs = new Set(relevant.map(atom => atom.id));
    return [...relevant, ...recent.filter(atom => !relevantIDs.has(atom.id))].slice(0, limit);
}
export function renderSemanticAssessmentGate(m) {
    const semantic = m.identity.semantic_assessment;
    const messageKinds = semantic.phase === 'initial' ? 'mission|non-material' : 'amendment|constraint|verification|stop|resume|non-material';
    const activeAtoms = boundedRelevantActiveAtoms(m), atomLines = semantic.phase === 'followup' ? [`constraint_atoms[] only for constraint: {subject_kind:path|capability|methodology|decision|generic,subject,predicate:mutate|read|use|require|preserve|verify,polarity:ALLOW|DENY|REQUIRE,scope:mission|task,supersedes:[ca_id]}; supersede only explicit user reversal; path=relative/glob.`, activeAtoms.length ? `active_atoms=${activeAtoms.map(a => `${a.id}:${a.polarity}:${a.predicate}:${a.subject_kind}:${a.subject}`).join('|')}` : 'active_atoms=none'] : [];
    const phaseRule = semantic.phase === 'initial' ? 'Init: file/repo/tool work=>mission=true; pure chat=>non-material=false.' : 'Follow-up: preserve prior semantics unless changed; non-material=>false; others=>true.';
    return [
        'Hi SEMANTIC ASSESSMENT GATE',
        `rev=${semantic.revision};phase=${semantic.phase}; call hi_intent_assess once; user language; no keyword heuristic.`,
        `JSON(all keys required; []=empty): material:boolean;message_kind=${messageKinds};task_kind=implementation|bug-fix|diagnosis|review|performance|release-readiness;scope=local|multi-file|repo-wide|external|multi-stream;risk=low|medium|high|authority-boundary;ambiguity=none|resolvable|contract-critical;dependency_class=independent|sequential|external-gated|unknown|independent-multi;required_capabilities=C[];requested_external_actions=X[];likely_verification=V[];likely_targets[];intent_signals[]${semantic.phase === 'followup' ? ';constraint_atoms[]' : ''}.`,
        ...atomLines,
        `C=${SEMANTIC_CAPABILITIES.join('|')}; X=${SEMANTIC_EXTERNAL_ACTIONS.join('|')}; V=${SEMANTIC_VERIFICATION_KINDS.join('|')}. intent_signals=[] by default; intent.<slug>:intent.tdd; unknown signals reject; capability-named signals reject.`,
        'scope and dependency_class describe material implementation/change work units; multi-file=>2+ material targets; not test files that the user says must remain unchanged; sequential=2+ ordered units; one implementation change followed by verification is not a sequential dependency.',
        'intent.tdd=test-first; test command=verification. diagnosis is read-only root cause/no fix; otherwise intent.debugging requires material diagnosis + repository-analysis. independent-review only for explicit user independence or risk/policy requirement. interactive-process=persistent; mcp=exact child MCP; bounded=native shell. X nonempty=>risk=authority-boundary.',
        phaseRule,
    ].join('\n');
}
