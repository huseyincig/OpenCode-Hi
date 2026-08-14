import { observeToolBefore } from '../runtime/evidence/evidence-runtime.js';
import { beginAuthorizedAction, claimAuthorizedAction, privilegedAction } from '../runtime/safety/authority.js';
import { canonicalExternalCommand } from '../runtime/safety/command-classifier.js';
import { matchRollback } from '../runtime/mutations/temporary-mutations.js';
import { assertSafeGitMutation, invalidateStagingProof, invalidateGitTopologyProof, beginGitTopologyMutation, mutatesGitIndex, isGitTopologyMutation } from '../runtime/safety/staging-safety.js';
import { assertReleaseChainPrecondition, isPackagePublish, isReleaseCreate } from '../runtime/safety/release-chain.js';
import { activateMethodologySignal } from '../runtime/methodology/activation.js';
import { assertChildMethodologyLoad, assertParentMethodologyLoad, requestedMethodologyName } from '../runtime/methodology/native-loading.js';
import { evaluateShellCommand } from '../runtime/process/shell-policy.js';
import { appendLedger } from '../runtime/ledger/ledger.js';
import { openHumanDecision } from '../runtime/human-decision/runtime.js';
export function createToolBeforeHook(store, background, projectRoot) {
    return async (input, output) => {
        const sid = input?.sessionID ?? input?.sessionId, child = sid && background ? background.list().find(w => w.session_id === sid) : undefined, m = child ? store.get(child.parent_session_id) : store.get(sid);
        if (!m)
            return;
        if (child && ((child.parent_mission_id !== undefined && child.parent_mission_id !== m.mission_id) || (child.generation_at_spawn !== undefined && child.generation_at_spawn !== m.generation)))
            return;
        const tool = String(input?.tool ?? ''), args = output?.args ?? input?.args ?? {};
        if (child && tool.startsWith('hi_'))
            throw new Error(`Hi ownership guard: child workers cannot invoke Hi control-plane tool '${tool}'.`);
        if (m.semantic_assessment.status === 'pending') {
            const allowed = new Set(['hi_intent_assess', 'hi_status', 'hi_ledger', 'hi_readiness']);
            if (!allowed.has(tool))
                throw new Error(`Hi semantic gate: '${tool}' is blocked until the host primary submits the structured semantic assessment.`);
        }
        if (tool === 'skill') {
            const name = requestedMethodologyName(args);
            if (name && child)
                assertChildMethodologyLoad(m.workers.find(worker => worker.id === child.id), name);
            else if (name)
                assertParentMethodologyLoad(m, name, projectRoot);
        }
        if (tool === 'bash' && typeof args?.command === 'string') {
            const shell = evaluateShellCommand(args.command);
            if (shell.decision === 'DENY')
                throw new Error(`Hi shell policy: ${shell.reason}`);
            if (shell.decision === 'USER_ACTION_REQUIRED') {
                openHumanDecision(m, { semantic_type: 'credential_action', reason_code: 'interactive-shell', summary: shell.reason, worker_id: child?.id, response_schema: { kind: 'external-action' } });
                throw new Error(`Hi shell policy: ${shell.reason}`);
            }
            if (shell.decision === 'REWRITE') {
                args.command = shell.command;
                if (output?.args)
                    output.args.command = shell.command;
                appendLedger(m, 'shell.command.rewritten', { worker_id: child?.id, payload: { reason: shell.reason } });
            }
        }
        if (tool === 'bash' && typeof args?.command === 'string') {
            assertSafeGitMutation(m, args.command);
            if (mutatesGitIndex(args.command))
                invalidateStagingProof(m);
            if (isGitTopologyMutation(args.command)) {
                beginGitTopologyMutation(m, args.command);
                invalidateGitTopologyProof(m);
            }
        }
        if (tool === 'bash' && typeof args?.command === 'string' && privilegedAction(args.command)) {
            if (!canonicalExternalCommand(args.command))
                throw new Error('Hi authority boundary: external-effect commands must use canonical command form so OpenCode native permission patterns remain authoritative. Use the bash tool cwd field instead of git -C/wrappers, and place supported CLI options after the privileged subcommand.');
            if (isReleaseCreate(args.command) || isPackagePublish(args.command))
                activateMethodologySignal(m, projectRoot, { signal: 'release.boundary', producer: 'release', reason: 'A concrete release/package publication command reached the release safety boundary.' });
            assertReleaseChainPrecondition(m, args.command, projectRoot ?? args?.cwd);
            if (child)
                throw new Error('Hi authority boundary: child workers may not execute publish/push/deploy or other privileged external effects. Parent Hi must own the exact authority contract.');
            const claim = claimAuthorizedAction(m, args.command, args?.cwd);
            if (claim === 'duplicate')
                throw new Error('Hi idempotency guard: this exact privileged action is already in-flight or completed.');
            beginAuthorizedAction(m, args.command, args?.cwd);
        }
        if (m.status !== 'active' && !matchRollback(m, String(args?.command ?? '')))
            return;
        observeToolBefore(m, tool, args);
        store.updateProgress(m);
    };
}
