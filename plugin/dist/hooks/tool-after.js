import { runtimeSignal } from '../runtime/events/event-sink.js';
import { observeToolAfter } from '../runtime/evidence/evidence-runtime.js';
import { verificationEnvelopeFor, verificationSatisfied } from '../runtime/verification/policy.js';
import { completeAuthorizedAction, privilegedAction } from '../runtime/safety/authority.js';
import { recordStagingInspection, recordGitStatusInspection, invalidateStagingProof, invalidateGitTopologyProof, completeGitTopologyMutation, clearGitTopologyOwnershipAfterCommit, isGitCommit, isGitTopologyMutation, inspectCurrentGitChangedFiles } from '../runtime/safety/staging-safety.js';
import { matchRollback, resolveRollback } from '../runtime/mutations/temporary-mutations.js';
import { noteLocalReleaseMutation, notePrivilegedReleaseOutcome, recordRemoteReleaseVerification } from '../runtime/safety/release-chain.js';
import { syncMissionGates } from '../runtime/gates/gates.js';
import { recordChildMethodologyLoad, recordParentMethodologyLoad, requestedMethodologyName } from '../runtime/methodology/native-loading.js';
import { reconcileMethodologyExits } from '../runtime/methodology/exit.js';
import { assessChangedFileOwnership, assessRequiredTargetCoverage } from '../runtime/task/diff-ownership.js';
import { primaryRoleCanDirectImplementation } from '../runtime/roles/catalog.js';
import { evaluateCompletion } from '../runtime/completion/evaluator.js';
import { appendLedger } from '../runtime/ledger/ledger.js';
import { evidenceProducerAttemptForWorker } from '../runtime/evidence/applicability.js';
function outputText(output) { try {
    if (typeof output === 'string')
        return output;
    if (typeof output?.stdout === 'string')
        return output.stdout;
    if (typeof output?.output === 'string')
        return output.output;
    if (typeof output?.data === 'string')
        return output.data;
    return JSON.stringify(output ?? '');
}
catch {
    return String(output);
} }
function successOf(text) { return !/(^|\n)\s*(fail|failed|error)|exit\s*code\s*[1-9]/i.test(text); }
function numericExit(output) { for (const v of [output?.metadata?.exit, output?.metadata?.exitCode, output?.metadata?.exit_code, output?.exit, output?.exitCode, output?.exit_code]) {
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    if (typeof v === 'string' && /^-?\d+$/.test(v.trim()))
        return Number(v);
} return undefined; }
export function authorityOutcome(output, text) { const exit = numericExit(output); if (exit !== undefined)
    return exit === 0 ? 'success' : 'failure'; if (/(^|\n)\s*(fail|failed|error)|exit\s*code\s*[1-9]|timed?\s*out|timeout|transport|connection\s+(?:reset|lost|closed)|econn|socket\s+hang/i.test(text))
    return 'failure'; return 'unknown'; }
function reconcileDeterministicDirectImplementation(m, projectRoot) {
    if (m.identity.status !== 'active' || m.execution.adaptive_execution?.path !== 'DIRECT' || m.identity.intent.scope !== 'local' || !['low', 'medium'].includes(m.identity.risk) || !primaryRoleCanDirectImplementation(m.execution.primary_mode))
        return false;
    if (m.execution.tasks.some(t => !['completed', 'failed', 'cancelled'].includes(t.status)) || m.execution.workers.some(w => !['completed', 'failed', 'cancelled'].includes(w.status)))
        return false;
    const implementations = m.execution.obligations.filter(o => o.kind === 'implementation' && o.status === 'open');
    if (implementations.length !== 1 || implementations[0].id !== 'o-implementation')
        return false;
    if (m.execution.obligations.some(o => o.kind === 'analysis' && o.status === 'open') || m.execution.verification_policy.requireReview || m.execution.obligations.some(o => ['review', 'authority'].includes(o.kind) && o.status === 'open') || m.methodology.methodology_needs.length)
        return false;
    const mutationAt = m.execution.evidence.last_mutation_at;
    if (!mutationAt || !m.vcs.changed_files.length || !m.execution.verification_policy.requiredKinds.length || !verificationSatisfied(m, undefined, projectRoot).ok)
        return false;
    const envelope = verificationEnvelopeFor(m, undefined, projectRoot), postMutation = envelope.checks.length > 0 && envelope.checks.every(check => check.result === 'passed' && check.evidence_refs.some(ref => { const e = m.execution.evidence.items.find(item => item.id === ref); return Boolean(e && !e.invalidated_at && e.observed_at >= mutationAt); }));
    if (!postMutation)
        return false;
    const current = inspectCurrentGitChangedFiles(projectRoot);
    if (current === undefined)
        return false;
    const currentSet = new Set(current), directFiles = [...new Set(m.vcs.changed_files.map(file => file.replace(/\\/g, '/').replace(/^\.\//, '')).filter(file => currentSet.has(file)))];
    if (!directFiles.length)
        return false;
    const ownership = assessChangedFileOwnership(m.identity.intent.likelyTargets ?? [], directFiles, [], 'control-plane');
    if (ownership.collateral.length)
        return false;
    const o = implementations[0], coverage = assessRequiredTargetCoverage(o.requiredTargets ?? [], directFiles);
    if (coverage.missing.length) {
        appendLedger(m, 'implementation.required-targets-uncovered', { payload: { obligation: o.id, required: coverage.required, covered: coverage.covered, missing: coverage.missing, changed_files: directFiles.slice(0, 60), owner: 'parent-direct-evidence' } });
        return false;
    }
    o.status = 'closed';
    o.closedAt = Date.now();
    appendLedger(m, 'implementation.direct-evidence-reconciled', { payload: { obligation: o.id, files: directFiles.slice(0, 30), evidence_refs: envelope.checks.flatMap(check => check.evidence_refs).slice(0, 30), source: 'current-git-diff+fresh-required-verification' } });
    return true;
}
export function createToolAfterHook(store, background, events, projectRoot, workingDirectory) {
    return async (input, output) => {
        const sid = input?.sessionID ?? input?.sessionId, child = sid && background ? background.list().find(w => w.session_id === sid) : undefined, m = child ? store.get(child.parent_session_id) : store.get(sid);
        if (!m)
            return;
        if (child && ((child.parent_mission_id !== undefined && child.parent_mission_id !== m.identity.mission_id) || (child.generation_at_spawn !== undefined && child.generation_at_spawn !== m.continuation.generation)))
            return;
        const tool = String(input?.tool ?? ''), args = input?.args ?? {}, text = outputText(output);
        const childTask = child ? m.execution.tasks.find(t => t.id === child.task_id) : undefined, childVerificationOwner = child && childTask ? { source: `bash:child:${child.id}`, trusted_source_class: 'host-tool-observation', source_session_id: String(sid), task_id: childTask.id, obligation_ids: childTask.obligation_ids.filter(id => m.execution.obligations.some(o => o.id === id && o.kind === 'verification')), scope: [...childTask.scope], producer_attempt: evidenceProducerAttemptForWorker(m, child) } : undefined;
        const evidenceRoot = m.identity.intent.scope === 'local' ? (workingDirectory ?? projectRoot) : projectRoot;
        observeToolAfter(m, tool, args, output, evidenceRoot, childVerificationOwner);
        if (tool === 'skill') {
            const name = requestedMethodologyName(args);
            if (name) {
                if (child)
                    recordChildMethodologyLoad(m.execution.workers.find(worker => worker.id === child.id), name);
                else
                    recordParentMethodologyLoad(m, name);
            }
        }
        if (tool === 'bash' && typeof args?.command === 'string') {
            recordRemoteReleaseVerification(m, args.command, output, projectRoot);
            recordStagingInspection(m, args.command, output);
            recordGitStatusInspection(m, args.command, output);
            if (isGitCommit(args.command)) {
                invalidateStagingProof(m);
                if (numericExit(output) === 0)
                    clearGitTopologyOwnershipAfterCommit(m);
            }
            if (isGitTopologyMutation(args.command)) {
                invalidateGitTopologyProof(m);
                completeGitTopologyMutation(m, args.command, numericExit(output) === 0, text);
            }
            noteLocalReleaseMutation(m, args.command, numericExit(output) === 0);
            const rollback = matchRollback(m, args.command);
            if (rollback) {
                const exit = numericExit(output);
                if (exit !== undefined)
                    resolveRollback(m, rollback, exit === 0, text);
                else if (!successOf(text))
                    resolveRollback(m, rollback, false, text);
            }
            if (privilegedAction(args.command) && !child) {
                const ao = authorityOutcome(output, text);
                notePrivilegedReleaseOutcome(m, args.command, ao);
                completeAuthorizedAction(m, args.command, args?.cwd, ao, text);
            }
        }
        for (const o of m.execution.obligations.filter(x => x.kind === 'verification' && x.status === 'open'))
            if (verificationSatisfied(m, o.id, evidenceRoot).ok) {
                o.status = 'closed';
                o.closedAt = Date.now();
                appendLedger(m, 'obligation.closed', { payload: { obligation: o.id, owner: 'tool-after-verification-evidence' } });
            }
        const directReconciled = !child && reconcileDeterministicDirectImplementation(m, evidenceRoot);
        reconcileMethodologyExits(m, evidenceRoot);
        syncMissionGates(m, evidenceRoot);
        if (directReconciled && evaluateCompletion(m, evidenceRoot).complete)
            store.complete(sid);
        store.updateProgress(m);
        void events?.(runtimeSignal('evidence.updated', m.identity.mission_id, { worker_id: child?.id, payload: { fresh: m.execution.evidence.fresh, items: m.execution.evidence.items.length, direct_reconciled: directReconciled } }));
    };
}
