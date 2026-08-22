import { evaluateCompletion } from './evaluator.js';
import { verificationEnvelopeFor, verificationKindSatisfiesRequirement } from '../verification/policy.js';
import { discoverVerificationRoutes } from '../verification/discovery.js';
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
        if (routes.verification_route_status === 'none')
            ineffective.push('read', 'hi_readiness', 'unclassified-bash', 'redundant-verifier-child');
        return { action: 'VERIFY', completion_ready: false, wait_for: [], missing_evidence: missing, open_obligations, ineffective_actions: ineffective, ...routes };
    }
    if (completion.next === 'RECONCILE')
        return { action: 'RECONCILE', completion_ready: false, wait_for: [], missing_evidence: missing, open_obligations, ineffective_actions: [], ...EMPTY_ROUTES };
    return { action: 'CONTINUE', completion_ready: false, wait_for: [], missing_evidence: missing, open_obligations, ineffective_actions: [], ...EMPTY_ROUTES };
}
