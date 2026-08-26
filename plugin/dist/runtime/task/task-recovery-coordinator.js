import { automaticRecoveryCandidates, runtimeModelCandidateStatus } from '../routing/model-resolver.js';
import { classifyWorkerFailure } from '../worker/failure-classifier.js';
import { methodologyCatalog } from '../methodology/catalog.js';
import { releaseFailedTaskMethodologyNeeds } from '../methodology/activation.js';
import { ownershipContract } from '../skills/methodology.js';
import { DEFAULT_CONTEXT_BUDGET, clipText } from '../context/budget.js';
import { taskPromptToolOverrides } from '../routing/execution-profile.js';
import { beginWorkerAttempt } from '../worker/worker-runtime.js';
import { recordPreexistingUserBaseline } from '../safety/staging-safety.js';
import { appendLedger } from '../ledger/ledger.js';
import { clearCapabilityUnavailable } from '../readiness/capability-failure.js';
import { runtimeSignal } from '../events/event-sink.js';
import { syncMissionGates } from '../gates/gates.js';
import { EMPTY_PROJECT_SCHEDULING_PEER_VIEW } from '../scheduler/project-peer-view.js';
import { taskRuntimeAdmittedModel, reserveTaskRuntimeDispatch, bindTaskRuntimeHost, beginTaskRuntimeSettlement, releaseTaskRuntimeReservation } from '../scheduler/task-runtime-adapter.js';
import { recordRecoveryStrategy, recoveryModelHazard } from '../continuation/recovery-governor.js';
export class TaskRecoveryCoordinator {
    scheduler;
    registry;
    projectRoot;
    getConfig;
    getModels;
    getHostConfig;
    events;
    child;
    drainQueueCallback;
    workspaceBinding;
    getProjectPeerView;
    callbackDisposition(m, worker) { if ((worker.parent_mission_id !== undefined && worker.parent_mission_id !== m.identity.mission_id) || (worker.generation_at_spawn !== undefined && worker.generation_at_spawn !== m.continuation.generation))
        return 'stale-mission'; return 'accept'; }
    constructor(scheduler, registry, projectRoot, getConfig, getModels, getHostConfig, events, child, drainQueueCallback, workspaceBinding, getProjectPeerView = () => EMPTY_PROJECT_SCHEDULING_PEER_VIEW) {
        this.scheduler = scheduler;
        this.registry = registry;
        this.projectRoot = projectRoot;
        this.getConfig = getConfig;
        this.getModels = getModels;
        this.getHostConfig = getHostConfig;
        this.events = events;
        this.child = child;
        this.drainQueueCallback = drainQueueCallback;
        this.workspaceBinding = workspaceBinding;
        this.getProjectPeerView = getProjectPeerView;
    }
    async recoverCanonicalStall(m, assessment) {
        if (assessment.state !== 'STALLED' || assessment.inflight !== 'NO' || !assessment.destructive_recovery_allowed)
            return { disposition: 'NOOP', reason: 'canonical-stall-not-admitted' };
        const worker = [...m.execution.workers].reverse().find(w => Boolean(w.session_id) && !['failed', 'cancelled', 'busy', 'starting', 'queued'].includes(w.status));
        if (!worker)
            return { disposition: 'NOOP', reason: 'no-quiescent-worker-to-resume' };
        const task = m.execution.tasks.find(t => t.id === worker.task_id);
        if (!task)
            return { disposition: 'NOOP', reason: 'stalled-worker-task-missing' };
        let status = 'unknown';
        try {
            status = await this.child.status(worker.session_id);
        }
        catch { }
        if (status !== 'idle') {
            appendLedger(m, 'runtime.liveness-recovery.deferred', { task_id: task.id, worker_id: worker.id, payload: { reason: 'exact-old-execution-not-quiescent', host_status: status } });
            return { disposition: 'NOOP', reason: status === 'unknown' ? 'old-execution-reconcile-required' : 'old-execution-still-active', worker_id: worker.id, task_id: task.id };
        }
        const recovered = await this.recoverStagnation(m, 1, 'same-worker-resume');
        return recovered ? { disposition: 'RECOVERED', reason: 'canonical-stall-quiescent-resume', worker_id: worker.id, task_id: task.id } : { disposition: 'NOOP', reason: 'canonical-stall-recovery-not-admitted', worker_id: worker.id, task_id: task.id };
    }
    async recoverStagnation(m, level, action = 'same-worker-resume') {
        if ((action === 'same-worker-resume' && ![1, 2].includes(level)) || (action === 'model-escalation' && level !== 3) || m.identity.status !== 'active' || m.continuation.user_interrupted)
            return false;
        const worker = [...m.execution.workers].reverse().find(w => Boolean(w.session_id) && !['failed', 'cancelled', 'busy', 'starting', 'queued'].includes(w.status));
        if (!worker?.session_id)
            return false;
        const task = m.execution.tasks.find(t => t.id === worker.task_id);
        if (!task)
            return false;
        let exactStatus = 'unknown';
        try {
            exactStatus = await this.child.status(worker.session_id);
        }
        catch { }
        if (exactStatus !== 'idle') {
            appendLedger(m, 'worker.stagnation-recovery.deferred', { task_id: task.id, worker_id: worker.id, payload: { reason: 'exact-old-execution-not-quiescent', host_status: exactStatus, generation: m.continuation.generation } });
            return false;
        }
        try {
            this.workspaceBinding?.(m, task.id);
        }
        catch (error) {
            const marker = `workspace-orphan:${task.id}`;
            m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
            appendLedger(m, 'worker.recovery.workspace-blocked', { task_id: task.id, worker_id: worker.id, payload: { error: String(error) } });
            return false;
        }
        const model = worker.model, variant = worker.model_variant;
        if (!model)
            return false;
        if (action === 'model-escalation') {
            const hazard = recoveryModelHazard(m);
            if (!hazard.open || hazard.worker_id !== worker.id || hazard.model !== model) {
                appendLedger(m, 'worker.behavioral-model-escalation.rejected', { task_id: task.id, worker_id: worker.id, payload: { reason: hazard.reason, attempts: hazard.attempts } });
                return false;
            }
            const candidates = hazard.recovery_candidates;
            const next = candidates.find(id => runtimeModelCandidateStatus(id, this.getModels(), this.getConfig(), this.getHostConfig(), worker.role).ok);
            if (!next) {
                appendLedger(m, 'worker.behavioral-model-escalation.unavailable', { task_id: task.id, worker_id: worker.id, payload: { from: model, candidates } });
                return false;
            }
            const previousSession = worker.session_id, previousFork = worker.forked_from_session_id, previousStatus = worker.status, previousTaskStatus = task.status, nextVariant = task.execution_profile?.fallback_variants?.[next];
            worker.status = 'ready';
            task.status = 'waiting';
            const reservation = reserveTaskRuntimeDispatch(m, worker, next, this.scheduler, Date.now(), this.getProjectPeerView(m));
            if (!reservation.accepted) {
                worker.status = previousStatus;
                task.status = previousTaskStatus;
                return false;
            }
            try {
                this.child.recordModelProjection(worker, next, nextVariant);
                const child = await this.child.create(m.identity.session_id, `Hi · ${worker.role} · behavioral recovery · ${task.objective.slice(0, 40)}`, worker.role, next === 'host-default' ? undefined : next, nextVariant, this.workspaceBinding?.(m, task.id));
                if (!child?.id)
                    throw new Error('Behavioral recovery child session id missing');
                const recoverySessionID = String(child.id);
                worker.session_id = recoverySessionID;
                worker.forked_from_session_id = previousSession;
                const bound = bindTaskRuntimeHost(m, worker.id, recoverySessionID);
                if (!bound.accepted)
                    throw new Error(`Scheduler host binding failed during behavioral recovery: ${bound.reason}`);
                worker.loaded_methodologies = [];
                worker.model = next;
                worker.model_variant = nextVariant;
                worker.fallback_history = [...(worker.fallback_history ?? []), { from: model, to: next, variant: nextVariant, reason: 'recovery-only model escalation after two same-model corrections without semantic gain', phase: 'runtime', at: Date.now() }];
                worker.status = 'busy';
                worker.generation_at_spawn = m.continuation.generation;
                worker.parent_mission_id = m.identity.mission_id;
                worker.started_at = Date.now();
                task.status = 'running';
                this.registry.set(worker);
                recordPreexistingUserBaseline(m, await this.child.captureNativeDiff(worker, 'baseline'));
                const exitRequirements = worker.selected_methodologies.flatMap(name => { const item = methodologyCatalog(this.projectRoot).find(x => x.name === name); return item ? [`${name}: ${item.exitRequirements.join(', ')}`] : []; });
                const prompt = clipText([ownershipContract('child', worker.selected_methodologies), `Hi behavioral recovery for existing task ${task.id}.`, `The prior model ${model} received two bounded corrective attempts without semantic progress.`, `Recovery model: ${next}. This is recovery-only and does not change user routing preferences.`, `OBJECTIVE: ${task.objective}`, `SCOPE: ${task.scope.join(', ') || 'bounded by objective'}`, `CURRENT USER CONSTRAINTS: ${(task.constraints ?? []).join(' | ') || 'none'}.`, `OBSERVED CHANGED FILES SO FAR: ${m.vcs.changed_files.slice(-30).join(', ') || 'none'}`, `METHODOLOGY EXIT REQUIREMENTS: ${exitRequirements.join(' | ') || 'none'}`, worker.selected_methodologies.length ? 'Fresh context: reload every still-selected methodology through the native skill tool before applying it.' : 'No methodology is selected for this recovery.', 'Independently inspect the minimum current repository/evidence state needed to continue the SAME task. Do not trust or repeat the prior model strategy, do not restart top-level planning, and return the normal structured WorkerResult.'].join('\n'), DEFAULT_CONTEXT_BUDGET.max_handoff_chars);
                beginWorkerAttempt(task, worker);
                await this.child.sendProviderPrompt(recoverySessionID, prompt, worker.role, next === 'host-default' ? undefined : next, nextVariant, taskPromptToolOverrides(task.execution_profile?.tools ?? [], this.getHostConfig(), task.execution_profile?.mcp_servers ?? []), worker.attempt_prompt_message_id);
                recordRecoveryStrategy(m, { level: 3, action: 'model-escalation' }, 'started', Date.now(), { task_id: task.id, worker_id: worker.id, model, failure_signature: worker.last_runtime_failure_kind });
                appendLedger(m, 'worker.behavioral-model-escalation', { task_id: task.id, worker_id: worker.id, payload: { level, action, from: model, to: next, from_session: previousSession, to_session: recoverySessionID, generation: m.continuation.generation, reason: 'same-model-bounded-corrections-exhausted' } });
                void this.events?.(runtimeSignal('worker.recovered', m.identity.mission_id, { task_id: task.id, worker_id: worker.id, payload: { level, action, from: model, to: next } }));
                return true;
            }
            catch (error) {
                let stopped = true;
                if (worker.session_id && worker.session_id !== previousSession)
                    try {
                        stopped = await this.child.abortNativeSession(m, worker.session_id, 'behavioral-model-escalation-failed', worker.id, task.id);
                    }
                    catch {
                        stopped = false;
                    }
                if (stopped) {
                    releaseTaskRuntimeReservation(m, worker.id);
                    worker.session_id = previousSession;
                    worker.forked_from_session_id = previousFork;
                    worker.model = model;
                    worker.model_variant = variant;
                    worker.status = previousStatus;
                    task.status = previousTaskStatus;
                }
                else {
                    const marker = `behavioral-recovery-abort-unavailable:${task.id}:${worker.id}`;
                    m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
                    worker.status = 'busy';
                    task.status = 'running';
                }
                this.registry.set(worker);
                appendLedger(m, 'worker.behavioral-model-escalation.failed', { task_id: task.id, worker_id: worker.id, payload: { level, action, from: model, to: next, error: String(error), host_stopped: stopped } });
                return false;
            }
        }
        const previousWorkerStatus = worker.status, previousTaskStatus = task.status;
        worker.status = 'ready';
        task.status = 'waiting';
        if (taskRuntimeAdmittedModel(m, worker, [model], this.scheduler, this.getProjectPeerView(m)) !== model) {
            worker.status = previousWorkerStatus;
            task.status = previousTaskStatus;
            return false;
        }
        const reservation = reserveTaskRuntimeDispatch(m, worker, model, this.scheduler, Date.now(), this.getProjectPeerView(m));
        if (!reservation.accepted) {
            worker.status = previousWorkerStatus;
            task.status = previousTaskStatus;
            return false;
        }
        try {
            const bound = bindTaskRuntimeHost(m, worker.id, worker.session_id);
            if (!bound.accepted) {
                releaseTaskRuntimeReservation(m, worker.id);
                worker.status = previousWorkerStatus;
                task.status = previousTaskStatus;
                return false;
            }
            const previous = worker.model;
            worker.model = model;
            worker.model_variant = variant;
            worker.generation_at_spawn = m.continuation.generation;
            worker.parent_mission_id = m.identity.mission_id;
            worker.status = 'busy';
            task.status = 'running';
            this.registry.set(worker);
            const instruction = level === 1
                ? 'Hi stagnation recovery: continue the SAME task/session with one narrowly scoped corrective attempt. Preserve completed work and evidence. Do not restart planning.'
                : 'Hi stagnation recovery: continue the SAME task/session/model, but use a materially different corrective hypothesis or action from the prior attempt. Preserve completed work and evidence. Do not restart planning or change models.';
            beginWorkerAttempt(task, worker);
            this.child.recordModelProjection(worker, model, variant);
            await this.child.sendProviderPrompt(worker.session_id, clipText(`${instruction}\nReturn the normal structured WorkerResult.`, DEFAULT_CONTEXT_BUDGET.max_handoff_chars), worker.role, model === 'host-default' ? undefined : model, variant, taskPromptToolOverrides(task.execution_profile?.tools ?? [], this.getHostConfig(), task.execution_profile?.mcp_servers ?? []), worker.attempt_prompt_message_id);
            recordRecoveryStrategy(m, { level: level, action }, 'started', Date.now(), { task_id: task.id, worker_id: worker.id, model, failure_signature: worker.last_runtime_failure_kind });
            appendLedger(m, 'worker.stagnation-recovery', { task_id: task.id, worker_id: worker.id, payload: { level, action, from: previous, to: model, variant, generation: m.continuation.generation } });
            void this.events?.(runtimeSignal('worker.recovered', m.identity.mission_id, { task_id: task.id, worker_id: worker.id, payload: { level, action, from: previous, to: model, variant } }));
            return true;
        }
        catch (error) {
            let stopped = true;
            if (worker.session_id)
                try {
                    stopped = await this.child.abortNativeSession(m, worker.session_id, 'stagnation-recovery-failed', worker.id, task.id);
                }
                catch {
                    stopped = false;
                }
            if (stopped) {
                releaseTaskRuntimeReservation(m, worker.id);
                worker.status = 'ready';
                task.status = task.result?.status === 'DONE' ? 'completed' : task.result ? 'waiting' : 'blocked';
            }
            else {
                const marker = `stagnation-recovery-abort-unavailable:${task.id}:${worker.id}`;
                m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
                worker.status = 'busy';
                task.status = 'running';
            }
            this.registry.set(worker);
            appendLedger(m, 'worker.stagnation-recovery.failed', { task_id: task.id, worker_id: worker.id, payload: { level, action, error: String(error), host_stopped: stopped } });
            return false;
        }
    }
    providerRecoveryCandidates(worker) {
        const attempted = new Set();
        if (worker.model)
            attempted.add(worker.model);
        for (const transition of worker.fallback_history ?? []) {
            if (transition.from)
                attempted.add(transition.from);
            attempted.add(transition.to);
        }
        const automatic = automaticRecoveryCandidates(worker);
        return [...new Set([...(worker.fallbacks ?? []), ...automatic].filter(Boolean))].filter(model => !attempted.has(model));
    }
    async launchProviderRecoveryCandidate(m, worker, task, model, failedSession, failureKind, reason) {
        const runtimeCandidate = runtimeModelCandidateStatus(model, this.getModels(), this.getConfig(), this.getHostConfig(), worker.role);
        if (!runtimeCandidate.ok) {
            appendLedger(m, 'worker.runtime-fallback.skipped', { task_id: task.id, worker_id: worker.id, payload: { model, reason: runtimeCandidate.reason, failure_class: failureKind, phase: 'runtime-policy-revalidation' } });
            return 'FAILED';
        }
        const variant = task.execution_profile?.fallback_variants?.[model], previous = worker.model, reservation = reserveTaskRuntimeDispatch(m, worker, model, this.scheduler, Date.now(), this.getProjectPeerView(m));
        if (!reservation.accepted) {
            appendLedger(m, 'worker.runtime-fallback.skipped', { task_id: task.id, worker_id: worker.id, payload: { model, reason: reservation.reason, failure_class: failureKind, source: 'scheduler' } });
            return 'FAILED';
        }
        try {
            this.child.recordModelProjection(worker, model, variant);
            const child = await this.child.create(m.identity.session_id, `Hi · ${worker.role} · runtime recovery · ${task.objective.slice(0, 45)}`, worker.role, model === 'host-default' ? undefined : model, variant, this.workspaceBinding?.(m, task.id));
            if (!child?.id)
                throw new Error('Runtime fallback child session id missing');
            const recoverySessionID = String(child.id);
            worker.session_id = recoverySessionID;
            const bound = bindTaskRuntimeHost(m, worker.id, recoverySessionID);
            if (!bound.accepted)
                throw new Error(`Scheduler host binding failed during runtime fallback: ${bound.reason}`);
            worker.loaded_methodologies = [];
            worker.model = model;
            worker.model_variant = variant;
            worker.fallback_history = [...(worker.fallback_history ?? []), { from: previous, to: model, variant, reason: `${reason}; failure=${failureKind}`, phase: 'runtime', at: Date.now() }];
            worker.status = 'busy';
            worker.runtime_fallback_exhausted = false;
            worker.runtime_recovery_pending = true;
            worker.runtime_recovery_attempt = (worker.runtime_recovery_attempt ?? 0) + 1;
            worker.generation_at_spawn = m.continuation.generation;
            worker.parent_mission_id = m.identity.mission_id;
            worker.started_at = Date.now();
            task.status = 'running';
            this.registry.set(worker);
            const resolvedProviderBlockers = new Set((task.result?.open_issues ?? []).filter(issue => issue.startsWith('provider-failure:provider-transport:')));
            m.execution.blockers = m.execution.blockers.filter(blocker => !resolvedProviderBlockers.has(blocker));
            recordPreexistingUserBaseline(m, await this.child.captureNativeDiff(worker, 'baseline'));
            const exitRequirements = worker.selected_methodologies.flatMap(name => { const item = methodologyCatalog(this.projectRoot).find(x => x.name === name); return item ? [`${name}: ${item.exitRequirements.join(', ')}`] : []; });
            const prompt = clipText([ownershipContract('child', worker.selected_methodologies), `Hi terminal runtime recovery for existing task ${task.id}.`, `Failure class: ${failureKind}.`, failedSession ? `Previous failed session: ${failedSession}.` : 'Previous provider-terminal session is already quiescent and detached.', `Fallback model: ${model}.`, `Recovery authority: ${reason}.`, `OBJECTIVE: ${task.objective}`, `SCOPE: ${task.scope.join(', ') || 'bounded by objective'}`, `CURRENT USER CONSTRAINTS: ${(task.constraints ?? []).join(' | ') || 'none'}.`, `OBSERVED CHANGED FILES SO FAR: ${m.vcs.changed_files.slice(-30).join(', ') || 'none'}`, `METHODOLOGY EXIT REQUIREMENTS: ${exitRequirements.join(' | ') || 'none'}`, worker.selected_methodologies.length ? 'This is a fresh child session. Reload every still-selected methodology through the native skill tool before applying it.' : 'No methodology is selected for this recovery.', 'Preserve already-observed repository changes and bounded evidence, but do not assume the failed session context is present. Inspect only the minimum current state needed to continue the SAME task. Do not restart top-level planning. Return the normal structured WorkerResult.'].join('\n'), DEFAULT_CONTEXT_BUDGET.max_handoff_chars);
            beginWorkerAttempt(task, worker);
            await this.child.sendProviderPrompt(recoverySessionID, prompt, worker.role, model === 'host-default' ? undefined : model, variant, taskPromptToolOverrides(task.execution_profile?.tools ?? [], this.getHostConfig(), task.execution_profile?.mcp_servers ?? []), worker.attempt_prompt_message_id);
            appendLedger(m, 'worker.runtime-fallback', { task_id: task.id, worker_id: worker.id, payload: { from: previous, to: model, variant, reason, failure_class: failureKind, attempt: worker.runtime_recovery_attempt, from_session: failedSession, to_session: worker.session_id, session_mode: 'fresh' } });
            return 'RECOVERED';
        }
        catch (nextError) {
            worker.runtime_recovery_pending = false;
            let recoveryStopped = true;
            if (worker.session_id)
                try {
                    recoveryStopped = await this.child.abortNativeSession(m, worker.session_id, 'runtime-fallback-failed', worker.id, task.id);
                }
                catch {
                    recoveryStopped = false;
                }
            if (recoveryStopped) {
                releaseTaskRuntimeReservation(m, worker.id);
                worker.session_id = undefined;
                worker.status = 'ready';
                task.status = 'waiting';
                this.registry.set(worker);
            }
            else {
                const marker = `runtime-fallback-recovery-abort-unavailable:${task.id}:${worker.id}`;
                m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
                worker.status = 'busy';
                task.status = 'running';
                this.registry.set(worker);
            }
            appendLedger(m, 'worker.runtime-fallback.failed', { task_id: task.id, worker_id: worker.id, payload: { model, error: String(nextError), failure_class: failureKind, from_session: failedSession, host_stopped: recoveryStopped } });
            return recoveryStopped ? 'FAILED' : 'QUARANTINED';
        }
    }
    async resumeBlockedProviderFailure(m, workerID) {
        const worker = m.execution.workers.find(w => w.id === workerID), task = worker ? m.execution.tasks.find(t => t.id === worker.task_id) : undefined;
        if (!worker || !task || m.identity.status !== 'active' || m.continuation.user_interrupted || worker.session_id || task.result?.status !== 'BLOCKED')
            return false;
        const providerBlocked = worker.status === 'ready' && worker.last_runtime_failure_kind === 'provider-transport' && task.result.open_issues.some(issue => issue.startsWith('provider-failure:provider-transport:'));
        const preDispatchBlocked = worker.status === 'failed' && worker.attempt === 0 && task.result.open_issues.some(issue => issue === `model-dispatch-unavailable:${task.id}`) && automaticRecoveryCandidates(worker).length > 0;
        if (!providerBlocked && !preDispatchBlocked)
            return false;
        const candidates = this.providerRecoveryCandidates(worker), previousTaskStatus = task.status, previousWorkerStatus = worker.status;
        worker.status = 'ready';
        task.status = 'waiting';
        for (const model of candidates) {
            const automatic = !(worker.fallbacks ?? []).includes(model), reason = preDispatchBlocked ? 'bounded automatic recovery candidate after pre-dispatch runtime model unavailability' : automatic ? 'bounded automatic recovery candidate after host-terminal provider failure' : task.execution_profile?.fallback_reasons?.find(x => x.model === model)?.reason ?? 'explicit runtime fallback after provider-transport', failureKind = preDispatchBlocked ? 'model-dispatch-unavailable' : 'provider-transport';
            const result = await this.launchProviderRecoveryCandidate(m, worker, task, model, undefined, failureKind, reason);
            if (result === 'RECOVERED') {
                if (preDispatchBlocked) {
                    clearCapabilityUnavailable(m, 'model-dispatch');
                    m.execution.blockers = m.execution.blockers.filter(blocker => blocker !== 'capability-unavailable:model-dispatch');
                    appendLedger(m, 'worker.pre-dispatch-model-recovered', { task_id: task.id, worker_id: worker.id, payload: { model, reason } });
                }
                else
                    appendLedger(m, 'worker.runtime-fallback.resumed-blocked', { task_id: task.id, worker_id: worker.id, payload: { model, reason } });
                return true;
            }
            if (result === 'QUARANTINED')
                return false;
        }
        worker.status = previousWorkerStatus;
        task.status = previousTaskStatus;
        return false;
    }
    async recoverHostTerminalFailure(m, workerID, error) {
        const worker = m.execution.workers.find(w => w.id === workerID);
        if (!worker)
            return 'NOT_RECOVERED';
        const task = m.execution.tasks.find(t => t.id === worker.task_id), failure = classifyWorkerFailure(error);
        worker.last_runtime_failure_kind = failure.kind;
        worker.runtime_fallback_exhausted = false;
        appendLedger(m, 'worker.failure.classified', { task_id: task?.id, worker_id: worker.id, payload: { kind: failure.kind, stagnation: failure.stagnation, retryable: failure.retryable, reason: failure.reason } });
        // OpenCode owns transient provider retry/backoff and context compaction. Hi may only
        // start an alternate-model child after a host-terminal, retryable provider failure.
        // Explicit user/host model authority remains fail-closed; ephemeral automatic routing may
        // consume only its already-bounded recovery candidates after terminal provider failure.
        if (!failure.retryable || failure.kind !== 'provider-transport' || !worker.session_id || !task)
            return 'NOT_RECOVERED';
        const failedSession = worker.session_id, candidates = this.providerRecoveryCandidates(worker);
        appendLedger(m, 'worker.runtime-fallback.host-terminal-confirmed', { task_id: task.id, worker_id: worker.id, payload: { session_id: failedSession, failure_class: failure.kind, action: 'release-without-abort', candidates } });
        releaseTaskRuntimeReservation(m, worker.id);
        worker.session_id = undefined;
        worker.restart_reconcile_pending = false;
        worker.status = 'ready';
        task.status = 'waiting';
        this.registry.set(worker);
        for (const model of candidates) {
            const automatic = !(worker.fallbacks ?? []).includes(model), reason = automatic ? 'bounded automatic recovery candidate after host-terminal provider failure' : task.execution_profile?.fallback_reasons?.find(x => x.model === model)?.reason ?? `runtime fallback after ${failure.kind}`;
            const result = await this.launchProviderRecoveryCandidate(m, worker, task, model, failedSession, failure.kind, reason);
            if (result === 'RECOVERED')
                return 'RECOVERED';
            if (result === 'QUARANTINED')
                return 'QUARANTINED';
        }
        worker.runtime_fallback_exhausted = true;
        m.continuation.stagnation_count = 0;
        const blocker = `provider-failure:${failure.kind}:${worker.model ?? 'unknown'}`;
        m.execution.blockers = [...new Set([...m.execution.blockers, blocker])];
        task.status = 'blocked';
        task.updated_at = Date.now();
        task.result = { status: 'BLOCKED', summary: 'Runtime provider/model fallback chain exhausted.', changed_files: [], evidence: [], open_issues: [blocker], needs_context: ['provider/model availability or alternate execution path'] };
        appendLedger(m, 'worker.runtime-fallback.exhausted', { task_id: task.id, worker_id: worker.id, payload: { failure_class: failure.kind, attempted: [...new Set([worker.model, ...(worker.fallback_history ?? []).flatMap(x => [x.from, x.to]), ...candidates].filter(Boolean))] } });
        return 'NOT_RECOVERED';
    }
    fail(m, workerID, error) {
        const worker = m.execution.workers.find(w => w.id === workerID);
        if (!worker)
            return;
        if (worker.generation_at_spawn !== undefined && worker.generation_at_spawn !== m.continuation.generation) {
            appendLedger(m, 'worker.failure.stale-generation-ignored', { worker_id: worker.id });
            return;
        }
        const settlement = beginTaskRuntimeSettlement(m, worker);
        if (!settlement.accepted && settlement.reason !== 'reservation-not-found') {
            appendLedger(m, 'worker.failure.scheduler-fence-rejected', { worker_id: worker.id, payload: { reason: settlement.reason } });
            return;
        }
        const task = m.execution.tasks.find(t => t.id === worker.task_id), failureClass = worker.last_runtime_failure_kind, permissionFailure = failureClass === 'permission', providerFailure = failureClass === 'provider-transport', contextFailure = failureClass === 'context-overflow', toolFailure = failureClass === 'tool-incompatibility', model = worker.model ?? 'unknown';
        const marker = permissionFailure ? `permission-failure:${worker.id}` : providerFailure ? `provider-failure:provider-transport:${model}` : contextFailure ? `capability-unavailable:context-capacity:${model}` : toolFailure ? `capability-unavailable:tool-compatibility:${model}` : error;
        const needsContext = permissionFailure ? ['resolve OpenCode permission/authority and explicitly resume the mission'] : providerFailure ? ['provider/model availability or alternate execution path'] : contextFailure ? ['OpenCode context compaction was exhausted or could not resolve terminal context capacity; reduce bounded context/task scope or explicitly choose a model with known sufficient context capacity'] : toolFailure ? ['terminal tool/model compatibility failure was observed; repair tool availability or explicitly choose a model with proven required tool capability'] : [];
        worker.status = 'failed';
        worker.completed_at = Date.now();
        releaseTaskRuntimeReservation(m, worker.id);
        this.registry.delete(worker.id);
        if (permissionFailure || providerFailure || contextFailure || toolFailure)
            m.continuation.stagnation_count = 0;
        if (task) {
            task.status = 'failed';
            task.updated_at = Date.now();
            task.result = { status: 'FAILED', summary: error, changed_files: [], evidence: [], open_issues: [marker], needs_context: needsContext };
            releaseFailedTaskMethodologyNeeds(m, task.id);
        }
        m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
        appendLedger(m, 'worker.failed', { task_id: task?.id, worker_id: worker.id, payload: { error, failure_class: failureClass ?? 'unknown', blocker: marker } });
        void this.events?.(runtimeSignal('worker.failed', m.identity.mission_id, { task_id: task?.id, worker_id: worker.id, payload: { error, failure_class: failureClass ?? 'unknown' } }));
        syncMissionGates(m);
        this.drainQueueCallback();
    }
}
