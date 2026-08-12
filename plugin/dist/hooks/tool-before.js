import { observeToolBefore } from '../runtime/evidence/evidence-runtime.js';
import { beginAuthorizedAction, claimAuthorizedAction, privilegedAction } from '../runtime/safety/authority.js';
import { matchRollback } from '../runtime/mutations/temporary-mutations.js';
import { assertSafeGitMutation, invalidateStagingProof, invalidateGitTopologyProof, beginGitTopologyMutation, mutatesGitIndex, isGitTopologyMutation } from '../runtime/safety/staging-safety.js';
import { assertReleaseChainPrecondition } from '../runtime/safety/release-chain.js';
function requestedSkill(args) { for (const key of ['name', 'skill', 'skill_name', 'skillName'])
    if (typeof args?.[key] === 'string' && args[key].trim())
        return args[key].trim(); return undefined; }
export function createToolBeforeHook(store, background, projectRoot) {
    return async (input, output) => {
        const sid = input?.sessionID ?? input?.sessionId, child = sid && background ? background.list().find(w => w.session_id === sid) : undefined, m = child ? store.get(child.parent_session_id) : store.get(sid);
        if (!m)
            return;
        if (child && ((child.parent_mission_id !== undefined && child.parent_mission_id !== m.mission_id) || (child.generation_at_spawn !== undefined && child.generation_at_spawn !== m.generation)))
            return;
        const tool = String(input?.tool ?? ''), args = output?.args ?? input?.args ?? {};
        if (child && tool.startsWith('hhc_'))
            throw new Error(`HHC ownership guard: child workers cannot invoke HHC control-plane tool '${tool}'.`);
        if (tool === 'skill') {
            const name = requestedSkill(args);
            if (name && child) {
                const worker = m.workers.find(w => w.id === child.id), allowed = new Set(worker?.loaded_skills ?? []);
                if (!allowed.has(name))
                    throw new Error(`HHC child skill guard: '${name}' is outside this worker methodology allowlist.`);
            }
            else if (name) {
                m.parent_loaded_skills ??= [];
                if (!m.parent_loaded_skills.includes(name) && m.parent_loaded_skills.length >= 3)
                    throw new Error('HHC skill budget: parent session may load at most 3 distinct skills for one mission.');
                if (!m.parent_loaded_skills.includes(name))
                    m.parent_loaded_skills.push(name);
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
            assertReleaseChainPrecondition(m, args.command, projectRoot ?? args?.cwd);
            if (child)
                throw new Error('HHC authority boundary: child workers may not execute publish/push/deploy or other privileged external effects. Parent HHC must own the exact authority contract.');
            const claim = claimAuthorizedAction(m, args.command, args?.cwd);
            if (claim === 'duplicate')
                throw new Error('HHC idempotency guard: this exact privileged action is already in-flight or completed.');
            beginAuthorizedAction(m, args.command, args?.cwd);
        }
        if (m.status !== 'active' && !matchRollback(m, String(args?.command ?? '')))
            return;
        observeToolBefore(m, tool, args);
        store.updateProgress(m);
    };
}
