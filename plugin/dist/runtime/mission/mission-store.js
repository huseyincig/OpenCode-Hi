import { assessedIntent, provisionalIntent } from '../intent/semantic-assessment.js';
import { collectRepoContext } from '../intent/repo-context.js';
import { continuationBudget, resolveCategory } from '../routing/category.js';
import { appendLedger } from '../ledger/ledger.js';
import { verificationPolicyFor } from '../verification/policy.js';
import { syncMissionGates } from '../gates/gates.js';
import { minimumTeamFor } from '../routing/minimum-team.js';
import { decideAdaptiveExecution } from '../execution/adaptive-policy.js';
import { decideTopology } from '../execution/topology-policy.js';
import { activateMethodologySignal, suppressIntentMethodologySignals } from '../methodology/activation.js';
import { architectureMethodologySignals } from '../methodology/signals.js';
import { resolveHumanDecision } from '../human-decision/runtime.js';
import { createSchedulerLifecycleState } from '../../contracts/orchestration-core.js';
import { reduceSchedulerLifecycle } from '../scheduler/lifecycle.js';
function obligation(id, kind, summary, requiredEvidence = []) { return { id, kind, summary, status: 'open', requiredEvidence }; }
export class MissionStore {
    #bySession = new Map();
    #root;
    #repo;
    #getPrimaryMode;
    #getTopology;
    constructor(root = process.cwd(), nativeContext = {}, getPrimaryMode = () => 'auto', getTopology = () => ({ mode: 'adaptive', maxAgents: 4, parallelism: 2 })) { this.#root = root; this.#repo = collectRepoContext(root, nativeContext); this.#getPrimaryMode = getPrimaryMode; this.#getTopology = getTopology; }
    start(sessionID, userText, observedPrimary) {
        const intent = provisionalIntent(userText, this.#repo), now = Date.now(), primaryConfigured = this.#getPrimaryMode(), primary = observedPrimary ?? (primaryConfigured === 'manager' ? 'manager' : 'working-manager');
        const missionID = `m_${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
        const mission = {
            identity: { mission_id: missionID, session_id: sessionID, objective: intent.objective, intent, semantic_assessment: { status: 'pending', phase: 'initial', revision: 1, source: 'host-primary', pending_text: userText.slice(0, 12000) }, status: 'active', risk: intent.risk, created_at: now, updated_at: now },
            execution: { execution_mode: 'single', primary_mode: primary, verification_policy: { requiredKinds: [], requireFresh: true, requireReview: false, allowWorkerReportedEvidence: true }, adaptive_execution: { path: 'DIRECT', reasons: ['semantic assessment pending'] }, topology: { mode: 'single-agent', parallelism: 1, reason: ['semantic assessment pending'] }, obligations: [], tasks: [], workers: [], processes: [], isolation_decisions: [], workspace_leases: [], evidence: { fresh: false, items: [] }, ledger: [], blockers: [], constraints: [], native_todos_incomplete: 0, gates: [], scheduler: createSchedulerLifecycleState(missionID) },
            continuation: { generation: 1, iteration: 0, continuation_budget: continuationBudget('standard'), continuation_active: false, last_progress_signature: '', stagnation_count: 0, user_interrupted: false, resume_count: 0, last_user_message_at: now },
            context: { context_artifacts: [] },
            vcs: { changed_files: [], temporary_mutations: [] },
            authority: { pending_permissions: 0, pending_permission_ids: [] },
            release: {},
            methodology: { methodology_needs: [], parent_loaded_methodologies: [] }
        };
        syncMissionGates(mission);
        appendLedger(mission, 'mission.provisional', { payload: { semantic_revision: 1, technical_targets: intent.likelyTargets ?? [], repo: { name: this.#repo.name, ecosystems: this.#repo.ecosystems, markers: this.#repo.markers, native: this.#repo.native } } });
        mission.continuation.last_progress_signature = this.signature(mission);
        this.#bySession.set(sessionID, mission);
        return mission;
    }
    applyInitialSemanticAssessment(sessionID, assessment) {
        const m = this.get(sessionID);
        if (!m)
            throw new Error('No active Hi mission');
        if (m.identity.semantic_assessment.status !== 'pending' || m.identity.semantic_assessment.phase !== 'initial')
            throw new Error('Hi semantic assessment is not pending for initial mission');
        if (!['mission', 'non-material'].includes(assessment.message_kind))
            throw new Error('Initial semantic assessment requires message_kind=mission or non-material');
        const now = Date.now();
        m.identity.semantic_assessment.status = 'assessed';
        m.identity.semantic_assessment.assessed_at = now;
        if (!assessment.material) {
            m.identity.status = 'completed';
            m.execution.obligations = [];
            m.methodology.methodology_needs = [];
            appendLedger(m, 'semantic.non-material', { payload: { revision: m.identity.semantic_assessment.revision, source: m.identity.semantic_assessment.source } });
            syncMissionGates(m);
            m.identity.updated_at = now;
            m.continuation.last_progress_signature = this.signature(m);
            return m;
        }
        m.identity.intent = assessedIntent(m.identity.intent, assessment);
        m.identity.risk = m.identity.intent.risk;
        m.identity.objective = m.identity.intent.objective;
        const obligations = [];
        if (m.identity.intent.taskKind === 'bug-fix' || m.identity.intent.taskKind === 'performance')
            obligations.push(obligation('o-analysis', 'analysis', m.identity.intent.taskKind === 'bug-fix' ? 'Root cause understood' : 'Relevant performance bottleneck identified'));
        if (m.identity.intent.taskKind !== 'review' && m.identity.intent.taskKind !== 'release-readiness')
            obligations.push(obligation('o-implementation', 'implementation', 'Requested change completed'));
        if (m.identity.intent.taskKind === 'review')
            obligations.push(obligation('o-review', 'review', 'Requested review completed', m.identity.intent.likelyVerification));
        obligations.push(obligation('o-verification', 'verification', m.identity.intent.likelyVerification.join(', '), m.identity.intent.likelyVerification));
        if (m.identity.intent.risk === 'high')
            obligations.push(obligation('o-high-assurance', 'review', 'Security-sensitive change reviewed'));
        if (m.identity.intent.risk === 'authority-boundary')
            obligations.push(obligation('o-authority', 'authority', 'External action explicitly authorized and completed'));
        m.execution.obligations = obligations;
        m.execution.verification_policy = verificationPolicyFor(m.identity.intent);
        const category = resolveCategory(m.identity.intent), team = minimumTeamFor(m.identity.intent, m.execution.verification_policy, m.execution.primary_mode), adaptive = decideAdaptiveExecution(m.identity.intent), topology = decideTopology(m.identity.intent, this.#getTopology());
        m.execution.execution_mode = topology.executionMode;
        m.execution.primary_mode = team.primary;
        m.execution.adaptive_execution = { path: adaptive.path, reasons: adaptive.reasons };
        m.execution.topology = { mode: topology.mode, parallelism: topology.parallelism, reason: topology.reason };
        m.continuation.continuation_budget = continuationBudget(category);
        m.methodology.methodology_needs = [];
        const suppressed = new Set(assessment.suppressed_intent_signals);
        for (const signal of assessment.intent_signals)
            if (!suppressed.has(signal))
                activateMethodologySignal(m, this.#root, { signal, producer: 'intent', reason: 'Host primary semantic assessment reported this explicit intent signal.' });
        for (const signal of architectureMethodologySignals(m.identity.intent))
            activateMethodologySignal(m, this.#root, { signal: signal.name, producer: 'architecture', reason: signal.reason });
        syncMissionGates(m);
        appendLedger(m, 'semantic.assessed', { payload: { revision: m.identity.semantic_assessment.revision, source: m.identity.semantic_assessment.source, taskKind: m.identity.intent.taskKind, scope: m.identity.intent.scope, risk: m.identity.intent.risk, ambiguity: m.identity.intent.ambiguity, dependencyClass: m.identity.intent.dependencyClass, capabilities: m.identity.intent.requiredCapabilities, intent_signals: assessment.intent_signals, suppressed_intent_signals: assessment.suppressed_intent_signals, technical_targets: m.identity.intent.likelyTargets ?? [] } });
        m.identity.updated_at = now;
        m.continuation.last_progress_signature = this.signature(m);
        return m;
    }
    bindObservedPrimary(sessionID, primary) { const m = this.get(sessionID); if (!m || m.execution.primary_mode === primary)
        return; const previous = m.execution.primary_mode; m.execution.primary_mode = primary; appendLedger(m, 'primary.agent-observed', { payload: { previous, observed: primary, source: 'host-chat-message' } }); m.continuation.last_progress_signature = this.signature(m); }
    get(sessionID) { return this.#bySession.get(sessionID); }
    beginFollowupSemanticAssessment(sessionID, userText) {
        const m = this.get(sessionID);
        if (!m)
            throw new Error('No active Hi mission');
        if (!['active', 'waiting-user'].includes(m.identity.status))
            throw new Error('Hi follow-up semantic assessment requires an active/waiting mission');
        const text = userText.trim();
        if (!text)
            throw new Error('Empty follow-up cannot be assessed');
        if (m.authority.human_decision?.status === 'OPEN' && m.authority.human_decision.semantic_type !== 'authority_request')
            resolveHumanDecision(m, 'user-followup-received');
        if (m.authority.authority?.approved)
            m.authority.authority = { ...m.authority.authority, approved: undefined };
        if (m.authority.authority?.pending) {
            m.authority.authority = { ...m.authority.authority, pending: undefined };
            if (m.authority.human_decision?.status === 'OPEN' && m.authority.human_decision.semantic_type === 'authority_request')
                resolveHumanDecision(m, 'authority-invalidated-by-semantic-followup');
        }
        m.continuation.generation += 1;
        m.identity.semantic_assessment = { status: 'pending', phase: 'followup', revision: m.identity.semantic_assessment.revision + 1, source: 'host-primary', pending_text: text.slice(0, 12000) };
        m.identity.status = 'active';
        m.continuation.continuation_active = false;
        m.continuation.active_action_id = undefined;
        m.continuation.continuation_lock_until = undefined;
        m.continuation.suppress_until = undefined;
        m.continuation.pending_nudge = undefined;
        m.continuation.last_user_message_at = Date.now();
        appendLedger(m, 'semantic.followup-pending', { payload: { revision: m.identity.semantic_assessment.revision, generation: m.continuation.generation, preview: text.slice(0, 180) } });
        syncMissionGates(m);
        m.identity.updated_at = Date.now();
        m.continuation.last_progress_signature = this.signature(m);
        return m;
    }
    applyFollowupSemanticAssessment(sessionID, assessment) {
        const m = this.get(sessionID);
        if (!m)
            throw new Error('No active Hi mission');
        if (m.identity.semantic_assessment.status !== 'pending' || m.identity.semantic_assessment.phase !== 'followup')
            throw new Error('Hi semantic assessment is not pending for a follow-up');
        if (assessment.message_kind === 'mission')
            throw new Error('A follow-up assessment cannot use message_kind=mission');
        const text = m.identity.semantic_assessment.pending_text, now = Date.now();
        m.identity.semantic_assessment.status = 'assessed';
        m.identity.semantic_assessment.assessed_at = now;
        if (assessment.message_kind === 'non-material') {
            appendLedger(m, 'semantic.followup-non-material', { payload: { revision: m.identity.semantic_assessment.revision } });
            syncMissionGates(m);
            m.identity.updated_at = now;
            m.continuation.last_progress_signature = this.signature(m);
            return m;
        }
        if (assessment.message_kind === 'stop') {
            m.continuation.user_interrupted = true;
            m.continuation.interrupted_at = now;
            m.continuation.interrupted_reason = 'semantic-user-stop';
            m.identity.status = 'stopped';
            appendLedger(m, 'mission.stopped', { payload: { reason: 'semantic-user-stop', generation: m.continuation.generation } });
            syncMissionGates(m);
            m.identity.updated_at = now;
            m.continuation.last_progress_signature = this.signature(m);
            return m;
        }
        if (assessment.message_kind === 'resume') {
            m.continuation.user_interrupted = false;
            m.continuation.interrupted_reason = undefined;
            m.continuation.resumed_at = now;
            m.identity.status = 'active';
            appendLedger(m, 'mission.resumed', { payload: { reason: 'semantic-user-resume', generation: m.continuation.generation } });
            syncMissionGates(m);
            m.identity.updated_at = now;
            m.continuation.last_progress_signature = this.signature(m);
            return m;
        }
        const kind = assessment.message_kind;
        if (kind === 'constraint') {
            m.execution.constraints ??= [];
            if (!m.execution.constraints.includes(text))
                m.execution.constraints.push(text);
            m.identity.objective = `${m.identity.objective}\nConstraint: ${text}`.slice(0, 9000);
            for (const task of m.execution.tasks.filter(t => !['completed', 'failed', 'cancelled'].includes(t.status))) {
                task.constraints ??= [];
                if (!task.constraints.includes(text))
                    task.constraints.push(text);
                task.updated_at = now;
            }
        }
        else if (kind === 'verification') {
            m.identity.objective = `${m.identity.objective}\nFollow-up verification: ${text}`.slice(0, 9000);
            let verify = m.execution.obligations.find(o => o.kind === 'verification');
            if (!verify) {
                verify = obligation('o-followup-verification-r' + m.identity.semantic_assessment.revision, 'verification', `User verification follow-up: ${text.slice(0, 500)}`, assessment.likely_verification);
                m.execution.obligations.push(verify);
            }
            else {
                verify.status = 'open';
                verify.closedAt = undefined;
                verify.summary = `${verify.summary}; ${text.slice(0, 300)}`.slice(0, 700);
            }
        }
        else {
            m.identity.objective = `${m.identity.objective}\nFollow-up: ${text}`.slice(0, 9000);
            m.execution.obligations.push(obligation('o-followup-r' + m.identity.semantic_assessment.revision, 'implementation', `User follow-up: ${text.slice(0, 500)}`));
        }
        m.identity.intent = assessedIntent(m.identity.intent, assessment);
        m.identity.intent.objective = m.identity.objective;
        m.identity.risk = m.identity.intent.risk;
        const suppressed = new Set(assessment.suppressed_intent_signals);
        if (suppressed.size)
            suppressIntentMethodologySignals(m, [...suppressed], `Host primary semantic follow-up explicitly superseded intent methodology at revision ${m.identity.semantic_assessment.revision}.`);
        for (const signal of assessment.intent_signals)
            if (!suppressed.has(signal))
                activateMethodologySignal(m, this.#root, { signal, producer: 'intent', reason: `Host primary semantic follow-up assessment revision ${m.identity.semantic_assessment.revision}.` });
        if (m.identity.intent.risk === 'high' && !m.execution.obligations.some(o => o.id === 'o-high-assurance' && o.status === 'open'))
            m.execution.obligations.push(obligation('o-high-assurance', 'review', 'Security-sensitive change reviewed'));
        if (m.identity.intent.risk === 'authority-boundary' && !m.execution.obligations.some(o => o.kind === 'authority' && o.status === 'open'))
            m.execution.obligations.push(obligation(`o-authority-${now.toString(36)}`, 'authority', 'External action explicitly authorized and completed'));
        m.execution.verification_policy = verificationPolicyFor(m.identity.intent);
        for (const signal of architectureMethodologySignals(m.identity.intent))
            activateMethodologySignal(m, this.#root, { signal: signal.name, producer: 'architecture', reason: signal.reason });
        const category = resolveCategory(m.identity.intent), team = minimumTeamFor(m.identity.intent, m.execution.verification_policy, m.execution.primary_mode), adaptive = decideAdaptiveExecution(m.identity.intent, m), topology = decideTopology(m.identity.intent, this.#getTopology(), m);
        m.execution.execution_mode = topology.executionMode;
        m.execution.primary_mode = team.primary;
        m.execution.adaptive_execution = { path: adaptive.path, reasons: adaptive.reasons };
        m.execution.topology = { mode: topology.mode, parallelism: topology.parallelism, reason: topology.reason };
        m.continuation.continuation_budget = Math.max(m.continuation.continuation_budget, continuationBudget(category));
        m.identity.status = 'active';
        appendLedger(m, 'semantic.followup-assessed', { payload: { revision: m.identity.semantic_assessment.revision, message_kind: kind, taskKind: m.identity.intent.taskKind, scope: m.identity.intent.scope, risk: m.identity.intent.risk, ambiguity: m.identity.intent.ambiguity, dependencyClass: m.identity.intent.dependencyClass, intent_signals: assessment.intent_signals, suppressed_intent_signals: assessment.suppressed_intent_signals } });
        syncMissionGates(m);
        m.identity.updated_at = now;
        m.continuation.last_progress_signature = this.signature(m);
        return m;
    }
    restore(missions, uncleanShutdown = false) { const sessionIDs = new Set(), missionIDs = new Set(); for (const candidate of missions) {
        if (sessionIDs.has(candidate.identity.session_id))
            throw new Error(`Duplicate restored session identity ${candidate.identity.session_id}`);
        if (missionIDs.has(candidate.identity.mission_id))
            throw new Error(`Duplicate restored mission identity ${candidate.identity.mission_id}`);
        sessionIDs.add(candidate.identity.session_id);
        missionIDs.add(candidate.identity.mission_id);
    } for (const m of missions) {
        m.execution.scheduler ??= createSchedulerLifecycleState(m.identity.mission_id);
        if (m.execution.scheduler.reservations.length) {
            m.execution.scheduler = reduceSchedulerLifecycle(m.execution.scheduler, { type: 'RESTART_QUARANTINE', at: Date.now() }).state;
            appendLedger(m, 'scheduler.restart-quarantined', { payload: { reservations: m.execution.scheduler.reservations.length } });
        }
        if (m.authority.authority?.approved) {
            m.authority.authority = { ...m.authority.authority, approved: undefined };
            appendLedger(m, 'authority.approval.invalidated', { payload: { reason: 'runtime-restart' } });
        }
        m.continuation.continuation_active = false;
        m.continuation.active_action_id = undefined;
        m.continuation.continuation_failure_count = 0;
        m.continuation.last_continuation_failure_at = undefined;
        m.continuation.suppress_until = undefined;
        if (['active', 'waiting-user'].includes(m.identity.status)) {
            const restoredTeam = m.execution.execution_mode === 'team';
            if (restoredTeam) {
                m.execution.execution_mode = 'single';
                appendLedger(m, 'team.projection-reset', { payload: { reason: 'process-ephemeral-team-runtime', durable_tasks: m.execution.tasks.map(t => t.id), durable_workers: m.execution.workers.map(w => w.id), generation: m.continuation.generation } });
            }
            const now = Date.now();
            for (const w of m.execution.workers) {
                if (['created', 'queued', 'starting', 'busy'].includes(w.status)) {
                    const t = m.execution.tasks.find(x => x.id === w.task_id);
                    if (w.session_id) {
                        w.status = 'ready';
                        w.restart_reconcile_pending = true;
                        w.generation_at_spawn = m.continuation.generation;
                        if (t && !t.result) {
                            t.status = 'waiting';
                            t.result = { status: 'NEEDS_CONTEXT', summary: 'Runtime restarted while this worker was in flight; reconcile the existing child session before continuing.', changed_files: [], evidence: [], open_issues: [], needs_context: ['runtime-restart-reconcile'] };
                        }
                        else if (t && ['queued', 'running'].includes(t.status))
                            t.status = t.result?.status === 'DONE' ? 'completed' : 'waiting';
                    }
                    else {
                        const reservation = m.execution.scheduler?.reservations.find(r => r.workerId === w.id);
                        if (reservation?.phase === 'RECONCILING' && !reservation.hostExecutionId) {
                            const reconciled = reduceSchedulerLifecycle(m.execution.scheduler, { type: 'RECONCILE', reservationId: reservation.reservationId, attempt: reservation.attempt, outcome: 'NOT_STARTED', at: now });
                            if (reconciled.accepted) {
                                m.execution.scheduler = reconciled.state;
                                appendLedger(m, 'scheduler.restart-reconciled', { task_id: t?.id, worker_id: w.id, payload: { outcome: 'not-started', reservation_id: reservation.reservationId } });
                            }
                            else {
                                const marker = `scheduler-restart-reconcile-failed:${w.id}`;
                                m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
                                appendLedger(m, 'scheduler.restart-reconcile-failed', { task_id: t?.id, worker_id: w.id, payload: { reason: reconciled.reason, reservation_id: reservation.reservationId } });
                            }
                        }
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
            for (const t of m.execution.tasks)
                if (['queued', 'running'].includes(t.status))
                    t.status = t.result?.status === 'DONE' ? 'completed' : t.result ? 'waiting' : 'blocked';
            m.continuation.continuation_lock_until = undefined;
            if (uncleanShutdown) {
                const pendingBefore = m.authority.pending_permissions;
                m.authority.pending_permissions = 0;
                m.authority.pending_permission_ids = [];
                if (pendingBefore > 0)
                    appendLedger(m, 'permission.crash-reset', { payload: { cleared: pendingBefore, reason: 'permission requests are process-ephemeral and must be re-established' } });
                let invalidated = 0;
                for (const e of m.execution.evidence.items) {
                    if (!e.invalidated_at) {
                        e.invalidated_at = now;
                        invalidated++;
                    }
                }
                if (invalidated) {
                    m.execution.evidence.fresh = false;
                    appendLedger(m, 'evidence.crash-invalidated', { payload: { count: invalidated, reason: 'source/runtime state identity must be revalidated after unclean restart' } });
                }
            }
        }
        syncMissionGates(m);
        m.identity.updated_at = Date.now();
        m.continuation.last_progress_signature = this.signature(m);
        this.#bySession.set(m.identity.session_id, m);
        appendLedger(m, 'mission.restored', { payload: { status: m.identity.status, recovery: uncleanShutdown ? 'unclean-shutdown' : 'normal-restart', generation: m.continuation.generation, team_runtime: 'ephemeral-reset-to-single-if-needed' } });
        if (uncleanShutdown)
            appendLedger(m, 'runtime.crash-recovery', { payload: { action: 'ephemeral-workers-reconciled' } });
    } }
    remove(sessionID) { this.#bySession.delete(sessionID); }
    stop(sessionID, reason = 'user-stop') { const m = this.get(sessionID); if (!m)
        return; if (m.authority.human_decision?.status === 'OPEN')
        resolveHumanDecision(m, 'mission-stopped'); if (m.authority.authority?.pending || m.authority.authority?.approved)
        m.authority.authority = { ...m.authority.authority, pending: undefined, approved: undefined }; m.continuation.generation += 1; m.continuation.user_interrupted = true; m.continuation.interrupted_at = Date.now(); m.continuation.interrupted_reason = reason; m.identity.status = 'stopped'; m.continuation.continuation_active = false; m.continuation.active_action_id = undefined; m.continuation.continuation_lock_until = undefined; m.continuation.suppress_until = undefined; m.continuation.pending_nudge = undefined; appendLedger(m, 'mission.stopped', { payload: { reason, generation: m.continuation.generation } }); syncMissionGates(m); }
    noteUserMessage(sessionID) { const m = this.get(sessionID); if (!m)
        return; m.continuation.last_user_message_at = Date.now(); }
    resume(sessionID, reason = 'explicit-user-resume') { const m = this.get(sessionID); if (!m)
        return; if (m.authority.human_decision?.status === 'OPEN' && m.authority.human_decision.semantic_type !== 'authority_request')
        resolveHumanDecision(m, reason); if (m.authority.authority?.approved)
        m.authority.authority = { ...m.authority.authority, approved: undefined }; const wasInterrupted = m.continuation.user_interrupted || m.identity.status === 'stopped'; m.continuation.generation += 1; m.continuation.user_interrupted = false; m.continuation.interrupted_reason = undefined; m.continuation.resumed_at = Date.now(); m.continuation.resume_count = (m.continuation.resume_count ?? 0) + (wasInterrupted ? 1 : 0); m.continuation.continuation_active = false; m.continuation.active_action_id = undefined; m.continuation.continuation_lock_until = undefined; m.continuation.suppress_until = undefined; m.continuation.pending_nudge = undefined; if (['stopped', 'waiting-user'].includes(m.identity.status))
        m.identity.status = 'active'; appendLedger(m, 'mission.resumed', { payload: { reason, resume_count: m.continuation.resume_count, generation: m.continuation.generation } }); syncMissionGates(m); }
    complete(sessionID) { const m = this.get(sessionID); if (!m)
        return; if (m.authority.human_decision?.status === 'OPEN')
        resolveHumanDecision(m, 'mission-completed'); m.identity.status = 'completed'; syncMissionGates(m); appendLedger(m, 'mission.completed'); }
    all() { return [...this.#bySession.values()]; }
    updateProgress(m, countStagnation = false) { syncMissionGates(m); const next = this.signature(m), progressed = next !== m.continuation.last_progress_signature; if (progressed)
        m.continuation.stagnation_count = 0;
    else if (countStagnation)
        m.continuation.stagnation_count += 1; m.continuation.last_progress_signature = next; m.identity.updated_at = Date.now(); return progressed; }
    closeObligation(m, id) { const o = m.execution.obligations.find(x => x.id === id); if (!o)
        return; o.status = 'closed'; o.closedAt = Date.now(); syncMissionGates(m); appendLedger(m, 'obligation.closed', { payload: { obligation: id } }); }
    signature(m) { const data = JSON.stringify({ obligations: m.execution.obligations.map(o => [o.id, o.status]), tasks: m.execution.tasks.map(t => [t.id, t.status, t.result?.status, t.result?.open_issues, t.result?.needs_context]), workers: m.execution.workers.map(w => [w.id, w.status, w.model, w.model_variant, w.runtime_recovery_attempt]), processes: m.execution.processes.map(p => [p.process_id, p.status, p.cleanup_state, p.pid]), isolation: m.execution.isolation_decisions.map(d => [d.required, d.strategy, d.requested_by, d.scope]), workspaces: m.execution.workspace_leases.map(w => [w.lease_id, w.status, w.cleanup_state, w.workspace_path]), evidence: m.execution.evidence.items.map(e => [e.kind, e.outcome, e.invalidated_at, e.task_id, e.obligation_ids]), files: m.vcs.changed_files, blockers: m.execution.blockers, constraints: m.execution.constraints, tasks_constraints: m.execution.tasks.map(t => [t.id, t.constraints]), gates: m.execution.gates.map(g => [g.id, g.status, g.reason]), temporary: m.vcs.temporary_mutations.map(x => [x.id, x.status]), human_decision: m.authority.human_decision ? [m.authority.human_decision.decision_id, m.authority.human_decision.status, m.authority.human_decision.reason_code, m.authority.human_decision.resolved_at] : undefined, scheduler: m.execution.scheduler?.reservations.map(r => [r.reservationId, r.phase, r.attempt.attemptId, r.hostExecutionId]) }); let h = 2166136261; for (let i = 0; i < data.length; i++) {
        h ^= data.charCodeAt(i);
        h = Math.imul(h, 16777619);
    } return (h >>> 0).toString(16).padStart(8, '0'); }
}
