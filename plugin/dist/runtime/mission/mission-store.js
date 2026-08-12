import { normalizeIntent } from '../intent/normalize.js';
import { collectRepoContext } from '../intent/repo-context.js';
import { continuationBudget, resolveCategory } from '../routing/category.js';
import { resolveExecutionMode } from '../routing/execution-mode.js';
import { appendLedger } from '../ledger/ledger.js';
import { verificationPolicyFor } from '../verification/policy.js';
import { syncMissionGates } from '../gates/gates.js';
import { minimumTeamFor } from '../routing/minimum-team.js';
function obligation(id, kind, summary, requiredEvidence = []) { return { id, kind, summary, status: 'open', requiredEvidence }; }
export class MissionStore {
    #bySession = new Map();
    #repo;
    #getPrimaryMode;
    constructor(root = process.cwd(), nativeContext = {}, getPrimaryMode = () => 'auto') { this.#repo = collectRepoContext(root, nativeContext); this.#getPrimaryMode = getPrimaryMode; }
    start(sessionID, userText) {
        const intent = normalizeIntent(userText, this.#repo), now = Date.now(), category = resolveCategory(intent), execution = resolveExecutionMode(intent), obligations = [];
        if (intent.taskKind === 'bug-fix' || intent.taskKind === 'performance')
            obligations.push(obligation('o-analysis', 'analysis', intent.taskKind === 'bug-fix' ? 'Root cause understood' : 'Relevant performance bottleneck identified'));
        if (intent.taskKind !== 'review' && intent.taskKind !== 'release-readiness')
            obligations.push(obligation('o-implementation', 'implementation', 'Requested change completed'));
        if (intent.taskKind === 'review')
            obligations.push(obligation('o-review', 'review', 'Requested review completed', intent.likelyVerification));
        obligations.push(obligation('o-verification', 'verification', intent.likelyVerification.join(', '), intent.likelyVerification));
        if (intent.risk === 'high')
            obligations.push(obligation('o-high-assurance', 'review', 'Security-sensitive change reviewed'));
        if (intent.risk === 'authority-boundary')
            obligations.push(obligation('o-authority', 'authority', 'External action explicitly authorized and completed'));
        const verification = verificationPolicyFor(intent), team = minimumTeamFor(intent, verification, this.#getPrimaryMode());
        const mission = { mission_id: `m_${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`, session_id: sessionID, objective: intent.objective, intent, status: 'active', risk: intent.risk, execution_mode: execution.mode, primary_mode: team.primary, verification_policy: verification, generation: 1, iteration: 0, continuation_budget: continuationBudget(category), continuation_active: false, obligations, tasks: [], workers: [], evidence: { fresh: false, items: [] }, ledger: [], changed_files: [], blockers: [], constraints: [], native_todos_incomplete: 0, last_progress_signature: '', stagnation_count: 0, context_artifacts: [], gates: [], temporary_mutations: [], parent_loaded_skills: [], pending_permissions: 0, pending_permission_ids: [], user_interrupted: false, resume_count: 0, last_user_message_at: now, created_at: now, updated_at: now };
        syncMissionGates(mission);
        appendLedger(mission, 'mission.started', { payload: { taskKind: intent.taskKind, scope: intent.scope, risk: intent.risk, category, execution_mode: execution.mode, execution_reason: execution.reason, primary_mode: team.primary, minimum_team: team.roles, direct: team.direct, team_reason: team.reason, dependencyClass: intent.dependencyClass, ambiguity: intent.ambiguity, repo: { name: this.#repo.name, ecosystems: this.#repo.ecosystems, markers: this.#repo.markers, native: this.#repo.native } } });
        mission.last_progress_signature = this.signature(mission);
        this.#bySession.set(sessionID, mission);
        return mission;
    }
    get(sessionID) { return this.#bySession.get(sessionID); }
    amend(sessionID, userText, kind = 'amend') {
        const m = this.get(sessionID);
        if (!m || m.status !== 'active')
            return;
        const text = userText.trim();
        if (!text)
            return;
        const follow = normalizeIntent(text, this.#repo), now = Date.now(), followIndex = m.obligations.filter(o => o.id.startsWith('o-followup-')).length + 1, id = `o-followup-${now.toString(36)}-${followIndex.toString(36)}`;
        m.constraints ??= [];
        if (kind === 'constraint') {
            m.objective = `${m.objective}
Constraint: ${text}`.slice(0, 6000);
            if (!m.constraints.includes(text))
                m.constraints.push(text);
            for (const task of m.tasks.filter(t => !['completed', 'failed', 'cancelled'].includes(t.status))) {
                task.constraints ??= [];
                if (!task.constraints.includes(text))
                    task.constraints.push(text);
                task.updated_at = now;
            }
            // Restrictive user constraints invalidate in-flight child instructions. A reconciler may
            // resume the same session with the new generation; late callbacks from pre-constraint work stay stale.
            m.generation += 1;
        }
        else if (kind === 'verification') {
            m.objective = `${m.objective}
Follow-up verification: ${text}`.slice(0, 6000);
            let verify = m.obligations.find(o => o.kind === 'verification');
            if (!verify) {
                verify = obligation(id, 'verification', `User verification follow-up: ${text.slice(0, 500)}`, follow.likelyVerification);
                m.obligations.push(verify);
            }
            else {
                verify.status = 'open';
                verify.closedAt = undefined;
                verify.summary = `${verify.summary}; ${text.slice(0, 300)}`.slice(0, 700);
                verify.requiredEvidence = [...new Set([...(verify.requiredEvidence ?? []), ...follow.likelyVerification])];
            }
        }
        else {
            m.objective = `${m.objective}
Follow-up: ${text}`.slice(0, 6000);
            m.obligations.push(obligation(id, 'implementation', `User follow-up: ${text.slice(0, 500)}`));
        }
        const riskRank = { low: 0, medium: 1, high: 2, 'authority-boundary': 3 };
        if (riskRank[follow.risk] > riskRank[m.risk]) {
            m.risk = follow.risk;
            m.intent.risk = follow.risk;
        }
        const scopeRank = { 'local': 0, 'multi-file': 1, 'multi-stream': 2, 'repo-wide': 3, 'external': 4 };
        if (scopeRank[follow.scope] > scopeRank[m.intent.scope])
            m.intent.scope = follow.scope;
        const depRank = { 'unknown': 0, 'independent': 1, 'independent-multi': 2, 'sequential': 3, 'external-gated': 4 };
        if (depRank[follow.dependencyClass] > depRank[m.intent.dependencyClass])
            m.intent.dependencyClass = follow.dependencyClass;
        const ambRank = { 'none': 0, 'resolvable': 1, 'contract-critical': 2 };
        if (ambRank[follow.ambiguity] > ambRank[m.intent.ambiguity])
            m.intent.ambiguity = follow.ambiguity;
        if (kind !== 'constraint') {
            const mergedVerify = verificationPolicyFor(follow);
            m.verification_policy = { requiredKinds: [...new Set([...m.verification_policy.requiredKinds, ...mergedVerify.requiredKinds])], requireFresh: true, requireReview: m.verification_policy.requireReview || mergedVerify.requireReview, allowWorkerReportedEvidence: m.verification_policy.allowWorkerReportedEvidence && mergedVerify.allowWorkerReportedEvidence };
            m.intent.requiredCapabilities = [...new Set([...m.intent.requiredCapabilities, ...follow.requiredCapabilities])];
            m.intent.likelyVerification = [...new Set([...m.intent.likelyVerification, ...follow.likelyVerification])];
        }
        if (follow.risk === 'high' && !m.obligations.some(o => o.id === 'o-high-assurance' && o.status === 'open'))
            m.obligations.push(obligation('o-high-assurance', 'review', 'Security-sensitive change reviewed'));
        if (follow.risk === 'authority-boundary' && !m.obligations.some(o => o.kind === 'authority' && o.status === 'open'))
            m.obligations.push(obligation(`o-authority-${now.toString(36)}`, 'authority', 'External action explicitly authorized and completed'));
        const modeBefore = m.execution_mode, activeWorkers = m.workers.filter(w => !['completed', 'failed', 'cancelled'].includes(w.status));
        if (m.execution_mode !== 'team' && !(m.execution_mode === 'parallel' && activeWorkers.length > 0))
            m.execution_mode = resolveExecutionMode(m.intent, m).mode;
        m.primary_mode = minimumTeamFor(m.intent, m.verification_policy, this.#getPrimaryMode()).primary;
        m.continuation_active = false;
        m.active_action_id = undefined;
        m.continuation_lock_until = undefined;
        m.suppress_until = undefined;
        m.pending_nudge = undefined;
        appendLedger(m, 'mission.amended', { payload: { kind, obligation: kind === 'constraint' ? undefined : (kind === 'verification' ? 'o-verification' : id), preview: text.slice(0, 200), generation: m.generation, followup_risk: follow.risk, followup_capabilities: follow.requiredCapabilities, scope: follow.scope, dependencyClass: follow.dependencyClass, execution_mode: { before: modeBefore, after: m.execution_mode, active_workers: activeWorkers.length } } });
        syncMissionGates(m);
        m.last_progress_signature = this.signature(m);
        m.updated_at = now;
    }
    restore(missions, uncleanShutdown = false) { for (const m of missions) {
        if (!m?.session_id || !m?.mission_id)
            continue;
        if (!m.verification_policy)
            m.verification_policy = verificationPolicyFor(m.intent);
        m.primary_mode = minimumTeamFor(m.intent, m.verification_policy, this.#getPrimaryMode()).primary;
        m.generation = Math.max(1, Number(m.generation) || 1);
        m.continuation_active = false;
        m.active_action_id = undefined;
        m.continuation_failure_count = 0;
        m.last_continuation_failure_at = undefined;
        m.suppress_until = undefined;
        m.context_artifacts ??= [];
        m.constraints ??= [];
        m.gates ??= [];
        m.temporary_mutations ??= [];
        m.parent_loaded_skills ??= [];
        m.pending_permissions = Number.isFinite(m.pending_permissions) ? m.pending_permissions : 0;
        m.pending_permission_ids = Array.isArray(m.pending_permission_ids) ? m.pending_permission_ids : [];
        m.intent.dependencyClass ??= 'unknown';
        for (const t of m.tasks ?? []) {
            t.context_artifacts ??= [];
            t.constraints ??= [];
            t.obligation_ids ??= [];
            t.gate_ids ??= [];
        }
        if (m.status === 'active') {
            const restoredTeam = m.execution_mode === 'team';
            if (restoredTeam)
                m.execution_mode = 'single';
            const now = Date.now();
            for (const w of m.workers ?? []) {
                w.parent_mission_id ??= m.mission_id;
                if (['created', 'queued', 'starting', 'busy'].includes(w.status)) {
                    const t = m.tasks.find(x => x.id === w.task_id);
                    if (w.session_id) {
                        w.status = 'ready';
                        w.restart_reconcile_pending = true;
                        w.generation_at_spawn = m.generation;
                        if (t && !t.result) {
                            t.status = 'waiting';
                            t.result = { status: 'NEEDS_CONTEXT', summary: 'Runtime restarted while this worker was in flight; reconcile the existing child session before continuing.', changed_files: [], evidence: [], open_issues: [], needs_context: ['runtime-restart-reconcile'] };
                        }
                        else if (t && ['queued', 'running'].includes(t.status))
                            t.status = t.result?.status === 'DONE' ? 'completed' : 'waiting';
                    }
                    else {
                        w.status = 'failed';
                        w.completed_at = now;
                        if (t) {
                            t.status = 'blocked';
                            if (!t.result)
                                t.result = { status: 'BLOCKED', summary: 'Runtime restarted before a native child session was established; create a fresh bounded worker for this task.', changed_files: [], evidence: [], open_issues: [], needs_context: ['runtime-restart-fresh-worker'] };
                        }
                    }
                }
            }
            for (const t of m.tasks ?? [])
                if (['queued', 'running'].includes(t.status))
                    t.status = t.result?.status === 'DONE' ? 'completed' : t.result ? 'waiting' : 'blocked';
            m.continuation_lock_until = undefined;
            if (uncleanShutdown) {
                const pendingBefore = m.pending_permissions;
                m.pending_permissions = 0;
                m.pending_permission_ids = [];
                if (pendingBefore > 0)
                    appendLedger(m, 'permission.crash-reset', { payload: { cleared: pendingBefore, reason: 'permission requests are process-ephemeral and must be re-established' } });
                let invalidated = 0;
                for (const e of m.evidence.items ?? []) {
                    if (!e.invalidated_at) {
                        e.invalidated_at = now;
                        invalidated++;
                    }
                }
                if (invalidated) {
                    m.evidence.fresh = false;
                    appendLedger(m, 'evidence.crash-invalidated', { payload: { count: invalidated, reason: 'source/runtime state identity must be revalidated after unclean restart' } });
                }
            }
        }
        syncMissionGates(m);
        m.updated_at = Date.now();
        m.last_progress_signature = this.signature(m);
        this.#bySession.set(m.session_id, m);
        appendLedger(m, 'mission.restored', { payload: { status: m.status, recovery: uncleanShutdown ? 'unclean-shutdown' : 'normal-restart', generation: m.generation, team_runtime: 'ephemeral-reset-to-single-if-needed' } });
        if (uncleanShutdown)
            appendLedger(m, 'runtime.crash-recovery', { payload: { action: 'ephemeral-workers-reconciled' } });
    } }
    remove(sessionID) { this.#bySession.delete(sessionID); }
    stop(sessionID, reason = 'user-stop') { const m = this.get(sessionID); if (!m)
        return; m.generation += 1; m.user_interrupted = true; m.interrupted_at = Date.now(); m.interrupted_reason = reason; m.status = 'stopped'; m.continuation_active = false; m.active_action_id = undefined; m.continuation_lock_until = undefined; m.suppress_until = undefined; m.pending_nudge = undefined; appendLedger(m, 'mission.stopped', { payload: { reason, generation: m.generation } }); syncMissionGates(m); }
    noteUserMessage(sessionID) { const m = this.get(sessionID); if (!m)
        return; m.last_user_message_at = Date.now(); }
    resume(sessionID, reason = 'explicit-user-resume') { const m = this.get(sessionID); if (!m)
        return; const wasInterrupted = m.user_interrupted || m.status === 'stopped'; m.generation += 1; m.user_interrupted = false; m.interrupted_reason = undefined; m.resumed_at = Date.now(); m.resume_count = (m.resume_count ?? 0) + (wasInterrupted ? 1 : 0); m.continuation_active = false; m.active_action_id = undefined; m.continuation_lock_until = undefined; m.suppress_until = undefined; m.pending_nudge = undefined; if (['stopped', 'waiting-user'].includes(m.status))
        m.status = 'active'; appendLedger(m, 'mission.resumed', { payload: { reason, resume_count: m.resume_count, generation: m.generation } }); syncMissionGates(m); }
    complete(sessionID) { const m = this.get(sessionID); if (!m)
        return; m.status = 'completed'; syncMissionGates(m); appendLedger(m, 'mission.completed'); }
    all() { return [...this.#bySession.values()]; }
    updateProgress(m, countStagnation = false) { syncMissionGates(m); const next = this.signature(m), progressed = next !== m.last_progress_signature; if (progressed)
        m.stagnation_count = 0;
    else if (countStagnation)
        m.stagnation_count += 1; m.last_progress_signature = next; m.updated_at = Date.now(); return progressed; }
    closeObligation(m, id) { const o = m.obligations.find(x => x.id === id); if (!o)
        return; o.status = 'closed'; o.closedAt = Date.now(); syncMissionGates(m); appendLedger(m, 'obligation.closed', { payload: { obligation: id } }); }
    signature(m) { const data = JSON.stringify({ obligations: m.obligations.map(o => [o.id, o.status]), tasks: m.tasks.map(t => [t.id, t.status, t.result?.status, t.result?.open_issues, t.result?.needs_context]), workers: m.workers.map(w => [w.id, w.status, w.model, w.model_variant, w.runtime_recovery_attempt]), evidence: m.evidence.items.map(e => [e.kind, e.outcome, e.invalidated_at, e.task_id, e.obligation_ids]), files: m.changed_files, blockers: m.blockers, constraints: m.constraints, tasks_constraints: m.tasks.map(t => [t.id, t.constraints]), gates: m.gates.map(g => [g.id, g.status, g.reason]), temporary: m.temporary_mutations.map(x => [x.id, x.status]) }); let h = 2166136261; for (let i = 0; i < data.length; i++) {
        h ^= data.charCodeAt(i);
        h = Math.imul(h, 16777619);
    } return (h >>> 0).toString(16).padStart(8, '0'); }
}
