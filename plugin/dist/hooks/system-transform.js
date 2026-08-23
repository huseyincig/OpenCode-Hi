import { renderSemanticAssessmentGate } from '../runtime/intent/semantic-assessment-gate.js';
import { buildMissionRuntimeProjection, renderMissionRuntimeProjection } from '../runtime/context/mission-runtime-projection.js';
import { redactProviderContext } from '../runtime/privacy/boundary.js';
import { appendLedger } from '../runtime/ledger/ledger.js';
import { resolve } from 'node:path';
const ONBOARDING_DEDUPE_LIMIT = 128;
function rememberOnboarding(set, sessionID) { if (set.has(sessionID))
    return; while (set.size >= ONBOARDING_DEDUPE_LIMIT) {
    const oldest = set.values().next().value;
    if (oldest === undefined)
        break;
    set.delete(oldest);
} set.add(sessionID); }
export function createSystemTransformHook(store, background, projectRoot, workingDirectory, getSettingsOnboarding) { const onboardingOffered = new Set(); return async (input, output) => { if (isNativeHousekeeping(input, output))
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
    const onboarding = getSettingsOnboarding?.();
    if (sid && !onboardingOffered.has(String(sid)) && onboarding?.pending && onboarding.modelCount > 0) {
        rememberOnboarding(onboardingOffered, String(sid));
        output.system.push(`Hi FIRST-USE SETTINGS: ${onboarding.modelCount} effective connected model(s) are available and no explicit Hi project settings exist. After semantic assessment, if this message is a greeting or settings request, call hi_settings setup and offer Work Mode Adaptive/Single/Multi with child models Automatic by default. If this is material work, do not interrupt it; use Adaptive + Automatic defaults.`);
    }
    return;
} if (child && ((child.parent_mission_id !== undefined && child.parent_mission_id !== m.identity.mission_id) || (child.generation_at_spawn !== undefined && child.generation_at_spawn !== m.continuation.generation)))
    return; const worker = child ? m.execution.workers.find(w => w.id === child.id) : undefined, projection = buildMissionRuntimeProjection(m, worker, projectRoot), localBoundary = !child && m.identity.intent.scope === 'local' && ['low', 'medium'].includes(m.identity.risk) && workingDirectory && projectRoot && resolve(workingDirectory) !== resolve(projectRoot) ? `\nHi LOCAL OBSERVATION BOUNDARY: current working directory (${resolve(workingDirectory)}) is the primary evidence surface. Do not inspect the parent/worktree root (${resolve(projectRoot)}) merely for orientation. Expand there only when a concrete unresolved target, dependency, repository contract, or configuration requires it; otherwise stay inside the working directory and likely targets.` : '', text = redactProviderContext(renderMissionRuntimeProjection(projection) + localBoundary).providerText; if (output.system.includes(text))
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
