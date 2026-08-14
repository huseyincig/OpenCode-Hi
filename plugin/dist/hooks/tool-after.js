import { runtimeSignal } from '../runtime/events/event-sink.js';
import { observeToolAfter } from '../runtime/evidence/evidence-runtime.js';
import { verificationSatisfied } from '../runtime/verification/policy.js';
import { completeAuthorizedAction, privilegedAction } from '../runtime/safety/authority.js';
import { recordStagingInspection, recordGitStatusInspection, invalidateStagingProof, invalidateGitTopologyProof, completeGitTopologyMutation, clearGitTopologyOwnershipAfterCommit, isGitCommit, isGitTopologyMutation } from '../runtime/safety/staging-safety.js';
import { matchRollback, resolveRollback } from '../runtime/mutations/temporary-mutations.js';
import { noteLocalReleaseMutation, notePrivilegedReleaseOutcome, recordRemoteReleaseVerification } from '../runtime/safety/release-chain.js';
import { syncMissionGates } from '../runtime/gates/gates.js';
import { recordChildMethodologyLoad, recordParentMethodologyLoad, requestedMethodologyName } from '../runtime/methodology/native-loading.js';
import { reconcileMethodologyExits } from '../runtime/methodology/exit.js';
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
export function createToolAfterHook(store, background, events, projectRoot) {
    return async (input, output) => {
        const sid = input?.sessionID ?? input?.sessionId, child = sid && background ? background.list().find(w => w.session_id === sid) : undefined, m = child ? store.get(child.parent_session_id) : store.get(sid);
        if (!m)
            return;
        if (child && ((child.parent_mission_id !== undefined && child.parent_mission_id !== m.mission_id) || (child.generation_at_spawn !== undefined && child.generation_at_spawn !== m.generation)))
            return;
        const tool = String(input?.tool ?? ''), args = input?.args ?? {}, text = outputText(output);
        observeToolAfter(m, tool, args, output, projectRoot);
        if (tool === 'skill') {
            const name = requestedMethodologyName(args);
            if (name) {
                if (child)
                    recordChildMethodologyLoad(m.workers.find(worker => worker.id === child.id), name);
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
        const check = verificationSatisfied(m);
        if (check.ok) {
            const o = m.obligations.find(x => x.kind === 'verification' && x.status === 'open');
            if (o) {
                o.status = 'closed';
                o.closedAt = Date.now();
            }
        }
        reconcileMethodologyExits(m, projectRoot);
        syncMissionGates(m);
        store.updateProgress(m);
        void events?.(runtimeSignal('evidence.updated', m.mission_id, { worker_id: child?.id, payload: { fresh: m.evidence.fresh, items: m.evidence.items.length } }));
    };
}
