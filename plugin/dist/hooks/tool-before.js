import { isVerificationCommand, observeToolBefore, toolMayMutate, verificationCommandKind } from '../runtime/evidence/evidence-runtime.js';
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
import { verificationKindAdmittedForMission } from '../runtime/verification/policy.js';
import { HI_BROWSER_EXECUTION_TOOL_IDS } from '../runtime/browser/executor.js';
import { resolveBrowserExecutionOwner } from '../runtime/browser/ownership.js';
const NON_MATERIAL_CONTROL_TOOLS = new Set(['hi_intent_assess', 'hi_status', 'hi_ledger', 'hi_readiness', 'hi_role_models']);
export function createToolBeforeHook(store, background, projectRoot) {
    return async (input, output) => {
        const sid = input?.sessionID ?? input?.sessionId, child = sid && background ? background.list().find(w => w.session_id === sid) : undefined, m = child ? store.get(child.parent_session_id) : store.get(sid);
        if (!m)
            return;
        if (child && ((child.parent_mission_id !== undefined && child.parent_mission_id !== m.identity.mission_id) || (child.generation_at_spawn !== undefined && child.generation_at_spawn !== m.continuation.generation)))
            return;
        const tool = String(input?.tool ?? ''), args = output?.args ?? input?.args ?? {};
        if (!child && !NON_MATERIAL_CONTROL_TOOLS.has(tool) && store.reopenContradictedNonMaterial(String(sid), tool))
            throw new Error(`Hi non-material conclusion contradicted by work tool '${tool}'; initial semantic assessment was reopened and the tool was blocked before execution.`);
        if (child && tool.startsWith('hi_')) {
            const browserTool = HI_BROWSER_EXECUTION_TOOL_IDS.includes(tool);
            if (browserTool) {
                const owner = resolveBrowserExecutionOwner(m, { sessionID: String(sid), workerID: child.id, taskID: child.task_id });
                if (!owner)
                    throw new Error(`Hi browser execution guard: child '${child.id}' cannot invoke '${tool}' outside its active visual task/methodology.`);
            }
            else
                throw new Error(`Hi ownership guard: child workers cannot invoke Hi control-plane tool '${tool}'.`);
        }
        if (m.identity.status === 'active' && tool === 'task') {
            appendLedger(m, 'orchestration.native-task-blocked', { worker_id: child?.id, payload: { owner: child ? 'child' : 'parent', required_tool: 'hi_task_start' } });
            throw new Error(child ? 'Hi ownership guard: child workers cannot invoke the native OpenCode task runtime; parent Hi must delegate through hi_task_start.' : 'Hi ownership guard: native OpenCode task delegation is disabled while Hi owns the active mission; use hi_task_start.');
        }
        if (!child && m.identity.status === 'active' && m.execution.execution_mode === 'parallel' && toolMayMutate(tool, args) && !(tool === 'bash' && isVerificationCommand(String(args?.command ?? '')))) {
            appendLedger(m, 'orchestration.parent-mutation-blocked', { payload: { tool, reason: 'parallel-topology-requires-hi-task-owner', required_tool: 'hi_task_start' } });
            throw new Error(`Hi topology guard: parent direct mutation via '${tool}' is disabled for parallel execution; create bounded disjoint work units with hi_task_start.`);
        }
        if (m.identity.semantic_assessment.status === 'pending') {
            const allowed = new Set(['hi_intent_assess', 'hi_status', 'hi_ledger', 'hi_readiness', 'hi_role_models']);
            if (!allowed.has(tool))
                throw new Error(`Hi semantic gate: '${tool}' is blocked until the host primary submits the structured semantic assessment.`);
        }
        if (!child && m.identity.status === 'completed' && tool === 'bash' && typeof args?.command === 'string') {
            const kind = verificationCommandKind(args.command);
            if (kind)
                throw new Error(`Hi mission already completed from fresh required evidence; additional verifier '${kind}' is not admitted. Stop instead of running more checks.`);
        }
        if (!child && m.identity.status === 'active' && ['DIRECT', 'EVIDENCE'].includes(m.execution.adaptive_execution?.path ?? '') && m.identity.intent.scope === 'local' && !['high', 'authority-boundary'].includes(m.identity.risk) && tool === 'bash' && typeof args?.command === 'string') {
            const kind = verificationCommandKind(args.command);
            if (kind && !verificationKindAdmittedForMission(m, kind)) {
                const required = [...m.execution.verification_policy.requiredKinds];
                appendLedger(m, 'verification.unrequired-command-blocked', { payload: { kind, required, command: String(args.command).slice(0, 180), reason: 'parent-local-minimum-sufficient-verification' } });
                throw new Error(`Hi verification economy: '${kind}' is outside the required parent verification contract (${required.join(', ') || 'none'}). Run only required/stronger verification unless a failed required check, changed-surface replan, or semantic follow-up expands the contract.`);
            }
        }
        if (tool === 'skill') {
            const name = requestedMethodologyName(args);
            if (name && child)
                assertChildMethodologyLoad(m.execution.workers.find(worker => worker.id === child.id), name);
            else if (name)
                assertParentMethodologyLoad(m, name, projectRoot);
        }
        if (tool === 'bash' && typeof args?.command === 'string') {
            const shell = evaluateShellCommand(args.command);
            if (shell.decision === 'DENY')
                throw new Error(`Hi shell policy: ${shell.reason}`);
            if (shell.decision === 'USER_ACTION_REQUIRED') {
                openHumanDecision(m, { semantic_type: shell.human_decision_type ?? 'operational_action', reason_code: shell.reason_code ?? 'shell-user-action-required', summary: shell.reason, worker_id: child?.id, response_schema: { kind: 'external-action' } });
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
        if (m.identity.status !== 'active' && !matchRollback(m, String(args?.command ?? '')))
            return;
        observeToolBefore(m, tool, args, projectRoot);
        store.updateProgress(m);
    };
}
