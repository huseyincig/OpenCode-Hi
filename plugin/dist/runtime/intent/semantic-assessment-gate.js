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
    const phaseRule = semantic.phase === 'initial' ? 'file/repo/tool work=>mission=true; pure chat=>non-material=false.' : 'Follow-up: preserve prior semantics unless changed. resume=continue the existing unfinished contract without adding/changing requested outcomes; verification=check existing work only; amendment=add/change an implementation outcome and therefore requires C to include implementation for implementation/bug-fix/performance. Continuation/reconnect/handoff wording alone is resume, not amendment. non-material=>false; others=>true.';
    return [
        'Hi SEMANTIC ASSESSMENT GATE',
        `${semantic.phase};call hi_intent_assess once;user language`,
        `all keys required:material;message_kind=${messageKinds};task_kind=implementation|bug-fix|diagnosis|review|performance|release-readiness;scope=local|multi-file|repo-wide|external|multi-stream;risk=low|medium|high|authority-boundary;ambiguity=none|resolvable|contract-critical;dependency_class=independent|sequential|external-gated|unknown|independent-multi;required_capabilities=C[];requested_external_actions=X[];likely_verification=V[];verification_cases[];nonvisual_request_units[];capability_request_units;likely_targets[];intent_signals[]${semantic.phase === 'followup' ? ';constraint_atoms[]' : ''}`,
        ...atomLines,
        `C=${SEMANTIC_CAPABILITIES.join('|')};X=${SEMANTIC_EXTERNAL_ACTIONS.join('|')};V=${SEMANTIC_VERIFICATION_KINDS.join('|')}. visual-check=>verification_cases{id,subject,required_browser_actions:A[],source_units:RU[]};all RU=case source_units|nonvisual_request_units;else both=[];no RU trace;multi-stream C-map all RU;${semantic.phase === 'followup' ? 'resume/constraint empty cases+RU keeps prior; ' : ''}A=open|navigate|click|type|key|inspect|viewport|screenshot;reload=navigate+inspect;intent_signals=[] by default;intent.<slug>:intent.tdd;unknown signals reject;capability-named signals reject.`,
        'scope/dependency describe material change units;user-unchanged test files excluded;one change+verification != sequential.',
        'diagnosis=no-fix;review=no-write;review+fix=>bug-fix+C:implementation;docs=>C:documentation;verify!=test-authoring;intent.debugging=>diagnosis+repository-analysis;independent-review=explicit/risk;interactive-process=persistent;X nonempty=>risk=authority-boundary',
        phaseRule,
    ].join('\n');
}
