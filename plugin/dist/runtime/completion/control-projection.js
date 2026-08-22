import { evaluateCompletion } from './evaluator.js';
import { verificationEnvelopeFor, verificationKindSatisfiesRequirement } from '../verification/policy.js';
import { discoverVerificationRoutes } from '../verification/discovery.js';
import { primaryRoleCanDirectImplementation } from '../roles/catalog.js';
function activeWaits(m) {
    const workers = m.execution.workers.filter(w => ['created', 'queued', 'starting', 'busy'].includes(w.status)).map(w => `worker:${w.id}:${w.status}`);
    const tasks = m.execution.tasks.filter(t => ['created', 'queued', 'running'].includes(t.status) || (t.status === 'waiting' && !t.result)).map(t => `task:${t.id}:${t.status}`);
    const processes = m.execution.processes.filter(p => p.status === 'RUNNING').map(p => `process:${p.process_id}:RUNNING`);
    return [...new Set([...workers, ...tasks, ...processes])].slice(0, 8);
}
function missingVerification(m, projectRoot) {
    const out = [];
    for (const obligation of m.execution.obligations.filter(o => o.kind === 'verification')) {
        const envelope = verificationEnvelopeFor(m, obligation.id, projectRoot);
        for (const check of envelope.checks)
            if (check.result !== 'passed')
                out.push({ obligation_id: obligation.id, kind: check.kind, result: check.result });
    }
    return out.filter((item, index, all) => all.findIndex(other => other.obligation_id === item.obligation_id && other.kind === item.kind && other.result === item.result) === index).slice(0, 12);
}
function verificationRoutes(m, projectRoot, missing) {
    if (!projectRoot)
        return { verification_route_status: 'unknown', verification_routes: [] };
    const targets = m.vcs.changed_files.length ? m.vcs.changed_files : (m.identity.intent.likelyTargets ?? []);
    const discovered = discoverVerificationRoutes(projectRoot, targets), verification_routes = [];
    for (const required of [...new Set(missing.map(x => x.kind))])
        for (const route of discovered)
            if (verificationKindSatisfiesRequirement(required, route.evidenceKind))
                verification_routes.push({ required_kind: required, evidence_kind: route.evidenceKind, command: route.command, source: route.source });
    const unique = verification_routes.filter((route, index, all) => all.findIndex(other => other.required_kind === route.required_kind && other.command === route.command) === index).slice(0, 8);
    return { verification_route_status: unique.length ? 'available' : 'none', verification_routes: unique };
}
const EMPTY_ROUTES = { verification_route_status: 'unknown', verification_routes: [] };
/**
 * Pure/read-time control projection over canonical Mission/Evidence/Authority owners.
 * It never persists lifecycle state or invents a second planner. Its purpose is to
 * prevent consumers from rediscovering a decision that Hi already knows.
 */
export function projectControlDecision(m, projectRoot) {
    const completion = evaluateCompletion(m, projectRoot);
    const wait_for = activeWaits(m);
    const open_obligations = m.execution.obligations.filter(o => o.status === 'open').slice(0, 8).map(o => ({ id: o.id, kind: o.kind }));
    if (completion.complete)
        return { action: 'DONE', completion_ready: true, wait_for: [], missing_evidence: [], open_obligations: [], ineffective_actions: [], ...EMPTY_ROUTES };
    if (completion.next === 'USER_ACTION_REQUIRED')
        return { action: 'USER_ACTION_REQUIRED', completion_ready: false, wait_for: [], missing_evidence: missingVerification(m, projectRoot), open_obligations, ineffective_actions: [], ...EMPTY_ROUTES };
    if (wait_for.length)
        return { action: 'WAIT', completion_ready: false, wait_for, missing_evidence: [], open_obligations, ineffective_actions: [], ...EMPTY_ROUTES };
    if (m.execution.execution_mode === 'parallel' && m.execution.tasks.length === 0 && open_obligations.some(o => o.kind !== 'verification'))
        return { action: 'CONTINUE', completion_ready: false, wait_for: [], missing_evidence: [], open_obligations, ineffective_actions: [], ...EMPTY_ROUTES };
    const missing = missingVerification(m, projectRoot);
    if (completion.next === 'VERIFY') {
        const routes = verificationRoutes(m, projectRoot, missing), ineffective = ['hi_direct_progress', 'hi_context_artifact_add', 'worker-result-pass-claim'];
        if (routes.verification_route_status === 'none') {
            ineffective.push('read', 'hi_readiness', 'unclassified-bash');
            if (!missing.some(item => item.kind === 'visual-check' || item.kind === 'visual-evidence'))
                ineffective.push('redundant-verifier-child');
        }
        return { action: 'VERIFY', completion_ready: false, wait_for: [], missing_evidence: missing, open_obligations, ineffective_actions: ineffective, ...routes };
    }
    if (completion.next === 'RECONCILE')
        return { action: 'RECONCILE', completion_ready: false, wait_for: [], missing_evidence: missing, open_obligations, ineffective_actions: [], ...EMPTY_ROUTES };
    return { action: 'CONTINUE', completion_ready: false, wait_for: [], missing_evidence: missing, open_obligations, ineffective_actions: [], ...EMPTY_ROUTES };
}
/** One canonical model-facing instruction derived from the read-only control decision. */
export function controlDecisionInstruction(m, decision) {
    if (decision.action === 'DONE')
        return 'stop:mission-complete; emit final answer only now';
    if (decision.action === 'USER_ACTION_REQUIRED')
        return 'user-action:canonical-gate; explain the exact required user/runtime action without claiming completion';
    if (decision.action === 'WAIT')
        return `wait:${decision.wait_for[0] ?? 'active-runtime'}; use the owning Hi await/status surface, do not create duplicate work`;
    if (decision.action === 'RECONCILE')
        return 'reconcile:canonical-state; reconcile the existing result/session before any new verification or replacement worker';
    if (decision.action === 'VERIFY') {
        const missing = [...new Set(decision.missing_evidence.map(x => x.kind))], visual = missing.some(kind => kind === 'visual-check' || kind === 'visual-evidence');
        const visualWorker = m.execution.workers.find(w => w.role === 'visual-qa' && !['completed', 'failed', 'cancelled'].includes(w.status));
        if (visual && !visualWorker && m.identity.intent.requiredCapabilities.includes('visual-qa')) {
            const verificationIDs = decision.open_obligations.filter(o => o.kind === 'verification').map(o => o.id);
            return `verify:${missing.join(',') || 'visual-check'}; call hi_task_start with role=visual-qa, category=visual, required_evidence=${missing.join(',') || 'visual-check'}${verificationIDs.length ? `, obligation_ids=${verificationIDs.join(',')}` : ''}; the visual worker must use Hi browser tools (hi_browser_preview_open for task-scoped local files); then await/reconcile that same task; do not substitute unclassified bash or prose claims`;
        }
        if (decision.verification_route_status === 'available')
            return `verify:${missing.join(',') || 'required-evidence'}; route=${decision.verification_routes.map(x => x.command).join(' || ')}; evidence-owned; run only projected route(s); do not broaden without changed-surface evidence`;
        if (decision.verification_route_status === 'none')
            return `verify:${missing.join(',') || 'required-evidence'}; route=none; no-admissible-repo-native-verifier; report-gap-and-stop; use matching Hi-owned verifier only when the required capability explicitly owns this evidence; do not invent a verifier`;
        return `verify:${missing.join(',') || 'required-evidence'}; route=unknown; evidence-owned; do-not-use=${decision.ineffective_actions.join(',')}`;
    }
    const openWork = m.execution.obligations.find(o => o.status === 'open' && (o.kind === 'analysis' || o.kind === 'implementation'));
    if (openWork) {
        if (m.execution.execution_mode === 'parallel')
            return `continue:${openWork.id}; delegate the bounded work through hi_task_start; do not mutate from the parent`;
        if (openWork.kind === 'implementation' && primaryRoleCanDirectImplementation(m.execution.primary_mode) && ['DIRECT', 'EVIDENCE'].includes(m.execution.adaptive_execution?.path ?? ''))
            return `continue:${openWork.id}; perform the minimum owned mutation, then call hi_direct_progress with obligation_id=${openWork.id} after the requested change is actually complete; do not emit a terminal answer before it returns RECORDED`;
        if (openWork.kind === 'analysis')
            return `continue:${openWork.id}; gather only the evidence needed to resolve the analysis, then call hi_direct_progress with obligation_id=${openWork.id}; do not start verification first`;
        return `continue:${openWork.id}; satisfy this canonical obligation before verification`;
    }
    return 'continue:canonical-open-obligation; use the existing owner/tool for the remaining obligation; do not restart planning';
}
