import { renderSemanticAssessmentGate } from '../runtime/intent/semantic-assessment-gate.js';
import { buildMissionRuntimeProjection, renderMissionRuntimeProjection } from '../runtime/context/mission-runtime-projection.js';
import { redactProviderContext } from '../runtime/privacy/boundary.js';
import { appendLedger } from '../runtime/ledger/ledger.js';
export function createSystemTransformHook(store, background, projectRoot) { return async (input, output) => { if (isNativeHousekeeping(input, output))
    return; const sid = input?.sessionID ?? input?.sessionId, child = sid && background ? background.list().find(w => w.session_id === sid) : undefined, m = child ? store.get(child.parent_session_id) : store.get(sid); if (!m || !Array.isArray(output?.system))
    return; if (!child && m.identity.status === 'completed') {
    const terminal = 'Hi MISSION COMPLETE: required evidence and obligations are closed. Stop; do not invoke more tools.';
    if (!output.system.includes(terminal))
        output.system.push(terminal);
    return;
} if (m.identity.status !== 'active')
    return; if (!child && m.identity.semantic_assessment.status === 'pending') {
    const gate = renderSemanticAssessmentGate(m);
    if (output.system.includes(gate))
        return;
    if (output.system.some((x) => typeof x === 'string' && x.includes('Hi SEMANTIC ASSESSMENT GATE')))
        appendLedger(m, 'host.composition-collision', { payload: { surface: 'system-transform', reason: 'hi-semantic-gate-marker-without-canonical-projection' } });
    output.system.push(gate);
    return;
} if (child && ((child.parent_mission_id !== undefined && child.parent_mission_id !== m.identity.mission_id) || (child.generation_at_spawn !== undefined && child.generation_at_spawn !== m.continuation.generation)))
    return; const worker = child ? m.execution.workers.find(w => w.id === child.id) : undefined, projection = buildMissionRuntimeProjection(m, worker, projectRoot), text = redactProviderContext(renderMissionRuntimeProjection(projection)).providerText; if (output.system.includes(text))
    return; if (output.system.some((x) => typeof x === 'string' && x.includes('Hi MISSION RUNTIME PROJECTION')))
    appendLedger(m, 'host.composition-collision', { task_id: worker?.task_id, worker_id: worker?.id, payload: { surface: 'system-transform', reason: 'hi-runtime-marker-without-canonical-projection' } }); output.system.push(text); }; }
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
