import { HI_METHODOLOGY_SIGNAL_CATALOG } from '../generated/methodology-policy.js';
import { SEMANTIC_CAPABILITIES, SEMANTIC_EXTERNAL_ACTIONS, SEMANTIC_VERIFICATION_KINDS } from '../runtime/intent/semantic-assessment.js';
import { buildMissionRuntimeProjection, renderMissionRuntimeProjection } from '../runtime/context/mission-runtime-projection.js';
export function createSystemTransformHook(store, background, _projectRoot) { return async (input, output) => { if (isNativeHousekeeping(input, output))
    return; const sid = input?.sessionID ?? input?.sessionId, child = sid && background ? background.list().find(w => w.session_id === sid) : undefined, m = child ? store.get(child.parent_session_id) : store.get(sid); if (!m || m.identity.status !== 'active' || !Array.isArray(output?.system))
    return; if (!child && m.identity.semantic_assessment.status === 'pending') {
    const intentSignals = Object.entries(HI_METHODOLOGY_SIGNAL_CATALOG).filter(([name, spec]) => name.startsWith('intent.') && spec.producers.includes('intent')).map(([name]) => name);
    output.system.push(['Hi SEMANTIC ASSESSMENT GATE', `Semantic revision: ${m.identity.semantic_assessment.revision}.`, 'The user message may be in any language. Do not classify it with language-specific keywords or translate it into an English keyword heuristic. Before any execution, call hi_intent_assess exactly once for this revision.', `Assessment phase: ${m.identity.semantic_assessment.phase}.`, 'Submit assessment_json as a JSON object with: material:boolean; message_kind=mission|amendment|constraint|verification|stop|resume|non-material; task_kind=implementation|bug-fix|review|performance|release-readiness; scope=local|multi-file|repo-wide|external|multi-stream; risk=low|medium|high|authority-boundary; ambiguity=none|resolvable|contract-critical; dependency_class=independent|sequential|external-gated|unknown|independent-multi; required_capabilities:string[]; requested_external_actions:string[]; likely_verification:string[]; likely_targets:string[]; intent_signals:string[]; suppressed_intent_signals:string[].', 'Interpret semantic meaning directly in the user language. Use likely_targets only for explicit/high-confidence targets; deterministic technical targets are already preserved by Hi. Select intent_signals only for explicit methodology-relevant user intent; runtime evidence may activate additional methodologies later. requested_external_actions must contain only external effects the user actually requested; any non-empty value requires risk=authority-boundary.', `Allowed capabilities: ${SEMANTIC_CAPABILITIES.join(', ')}`, `Allowed requested external actions: ${SEMANTIC_EXTERNAL_ACTIONS.join(', ')}`, `Allowed verification kinds: ${SEMANTIC_VERIFICATION_KINDS.join(', ')}`, `Allowed intent signals: ${intentSignals.join(', ')}`, m.identity.semantic_assessment.phase === 'initial' ? 'For initial assessment use message_kind=mission, or non-material with material=false.' : 'For follow-up assessment classify the user message as amendment, constraint, verification, stop, resume, or non-material. The other semantic fields describe the resulting mission state; preserve existing semantics unless the user actually changed them.', 'If the message is non-material/casual, set material=false; otherwise material=true. Still provide valid enum fields. Do not execute or delegate before the assessment is accepted.'].join('\n'));
    return;
} if (child && ((child.parent_mission_id !== undefined && child.parent_mission_id !== m.identity.mission_id) || (child.generation_at_spawn !== undefined && child.generation_at_spawn !== m.continuation.generation)))
    return; const worker = child ? m.execution.workers.find(w => w.id === child.id) : undefined, projection = buildMissionRuntimeProjection(m, worker); output.system.push(renderMissionRuntimeProjection(projection)); }; }
const NATIVE_HOUSEKEEPING_AGENTS = new Set(['title', 'summary', 'compaction']);
const NATIVE_HOUSEKEEPING_SYSTEM_PREFIXES = [
    'You are a title generator.',
    'You are an anchored context summarization assistant for coding sessions.',
    'Summarize what was done in this conversation. Write like a pull request description.',
];
function isNativeHousekeeping(input, output) {
    if (NATIVE_HOUSEKEEPING_AGENTS.has(String(input?.agent ?? input?.agentName ?? '').toLowerCase()))
        return true;
    // OpenCode 1.18.x omits `agent` from experimental.chat.system.transform for native title generation.
    // Fingerprint only the host-provided system prompt before Hi appends anything.
    const system = Array.isArray(output?.system) ? output.system : [];
    return system.some((x) => typeof x === 'string' && NATIVE_HOUSEKEEPING_SYSTEM_PREFIXES.some(prefix => x.startsWith(prefix)));
}
